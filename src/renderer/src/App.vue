<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import DropZone from './components/DropZone.vue';
import DraftList from './components/DraftList.vue';
import CompressionDraftList from './components/CompressionDraftList.vue';
import QueueList from './components/QueueList.vue';
import { useQueue } from './composables/useQueue';
import { TARGET_FORMAT_MAP, FORMATS_BY_CATEGORY } from '@shared/formats';
import type { ConversionRequestItem } from '@shared/ipc';
import { parseTargetSizeMb } from '@conversion/compress';
import type { CompressionDraftConfig, DraftItem } from './types';
import type { QualityPreset, TargetFormat } from '@shared/types';
import { userMessage } from '@shared/errors';

const { appInfo, jobs, messageFor } = useQueue();

const drafts = ref<DraftItem[]>([]);
const converting = ref(false);
const banner = ref<{ kind: 'error' | 'info'; text: string } | null>(null);

const globalFormat = ref<TargetFormat>('mp3');
const globalDescriptor = computed(() => TARGET_FORMAT_MAP[globalFormat.value]);

const mode = ref<'convert' | 'compress'>('convert');

const beforeIds = new Set<string>();
const batchIds = new Set<string>();
const completion = ref<{ hadIncompatible: boolean; compressed: boolean } | null>(null);

const categoryLabel: Record<string, string> = {
  audio: 'Áudio',
  video: 'Vídeo',
  image: 'Imagem',
};

function newCompressionConfig(): CompressionDraftConfig {
  return {
    maxSizeRaw: '',
    estimate: null,
    estimating: false,
    lastSyncKey: null,
  };
}

function segBtnClass(active: boolean): string {
  return active
    ? 'cursor-pointer rounded-md border border-accent bg-surface-raised px-4 py-1.5 text-sm font-medium text-ink transition-colors'
    : 'cursor-pointer rounded-md border border-edge px-4 py-1.5 text-sm text-ink-dim transition-colors hover:border-accent hover:text-ink';
}

function compatibleCount(): number {
  const category = globalDescriptor.value.category;
  return drafts.value.filter((d) => d.category === category).length;
}

function compressReadyCount(): number {
  const category = globalDescriptor.value.category;
  return drafts.value.filter(
    (d) =>
      d.category === category &&
      d.compression !== undefined &&
      parseTargetSizeMb(d.compression.maxSizeRaw) !== null,
  ).length;
}

const actionLabel = computed(() => {
  if (converting.value) return 'Adicionando à fila…';
  const count = mode.value === 'compress' ? compressReadyCount() : compatibleCount();
  const verb = mode.value === 'compress' ? 'Comprimir' : 'Converter';
  return `${verb} ${count} ${count === 1 ? 'arquivo' : 'arquivos'}`;
});

function addDrafts(paths: string[]): void {
  void window.api.inspectFiles(paths).then((result) => {
    const seen = new Set(drafts.value.map((d) => d.path));
    let added = 0;
    for (const file of result.files) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      drafts.value.push({ ...file, compression: newCompressionConfig() });
      added++;
    }
    const rejected = result.rejected.length;
    if (rejected > 0) {
      banner.value = {
        kind: 'error',
        text:
          rejected === 1
            ? userMessage(result.rejected[0]?.reason ?? 'UNSUPPORTED_SOURCE')
            : `${rejected} arquivos não foram suportados.`,
      };
    } else if (added > 0) {
      banner.value = null;
    }
  });
}

function removeDraft(index: number): void {
  drafts.value.splice(index, 1);
}

function removeAllDrafts(): void {
  drafts.value = [];
}

function updateConfig(
  index: number,
  patch: Partial<Pick<CompressionDraftConfig, 'maxSizeRaw'>>,
): void {
  const cfg = drafts.value[index]?.compression;
  if (cfg) Object.assign(cfg, patch);
}

function hasTerminalJobs(): boolean {
  return jobs.value.some((job) => ['completed', 'failed', 'cancelled'].includes(job.status));
}

function clearCompleted(): void {
  void window.api.clearCompleted();
}

function cancelJob(jobId: string): void {
  void window.api.cancelJob(jobId);
}

async function convertAll(): Promise<void> {
  if (drafts.value.length === 0 || converting.value) return;

  const isCompress = mode.value === 'compress';
  converting.value = true;
  banner.value = null;
  const category = globalDescriptor.value.category;
  const compatible: DraftItem[] = [];
  const incompatible: DraftItem[] = [];
  for (const d of drafts.value) {
    if (d.category === category) compatible.push(d);
    else incompatible.push(d);
  }
  const items: ConversionRequestItem[] = compatible
    .map((d): ConversionRequestItem | null => {
      if (!isCompress) {
        return {
          inputPath: d.path,
          targetFormat: globalFormat.value,
          quality: 'high' as QualityPreset,
        };
      }
      const cfg = d.compression;
      if (!cfg) return null;
      const maxSizeMb = parseTargetSizeMb(cfg.maxSizeRaw);
      if (maxSizeMb === null) return null;
      return {
        inputPath: d.path,
        targetFormat: globalFormat.value,
        quality: 'high' as QualityPreset,
        compression: { maxSizeMb },
      };
    })
    .filter((item): item is ConversionRequestItem => item !== null);
  const submitted = new Set(items.map((item) => item.inputPath));
  for (const job of jobs.value) beforeIds.add(job.id);
  try {
    const result =
      items.length > 0
        ? await window.api.startConversion({
            items,
            destination: null,
          })
        : { ok: true as const, created: 0, rejected: [] as { inputPath: string; error: string }[] };
    if (result.ok) {
      completion.value = {
        hadIncompatible: incompatible.length > 0,
        compressed: isCompress,
      };
      drafts.value = isCompress ? drafts.value.filter((d) => !submitted.has(d.path)) : [];
      if (incompatible.length > 0) {
        const verb = isCompress ? 'comprimido' : 'convertido';
        banner.value = {
          kind: 'error',
          text: `${incompatible.length} ${incompatible.length === 1 ? 'arquivo não pôde' : 'arquivos não puderam'} ser ${verb}${incompatible.length === 1 ? '' : 's'} para ${globalDescriptor.value.label}.`,
        };
      }
    } else {
      banner.value = { kind: 'error', text: userMessage(result.error) };
    }
  } finally {
    converting.value = false;
  }
}

let estimateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleEstimateSync(): void {
  if (estimateTimer) clearTimeout(estimateTimer);
  estimateTimer = setTimeout(() => {
    void syncEstimates();
  }, 350);
}

async function syncEstimates(): Promise<void> {
  if (mode.value !== 'compress') return;
  const category = globalDescriptor.value.category;
  const format = globalFormat.value;
  for (const draft of drafts.value) {
    const cfg = draft.compression;
    if (!cfg || draft.category !== category) continue;
    const raw = cfg.maxSizeRaw;
    const key = `${raw}`;
    if (cfg.estimating || cfg.lastSyncKey === key) continue;
    const maxMb = parseTargetSizeMb(raw);
    const probe = maxMb ?? 1;
    cfg.estimating = true;
    try {
      const result = await window.api.estimateCompression({
        inputPath: draft.path,
        targetFormat: format,
        maxSizeMb: probe,
      });
      let seeded = false;
      if (result.ok) {
        if (
          maxMb === null &&
          raw.trim() === '' &&
          result.estimate.recommendedMinMb !== null &&
          result.estimate.recommendedMinMb > 0
        ) {
          cfg.maxSizeRaw = String(Math.ceil(result.estimate.recommendedMinMb));
          seeded = true;
        }
        cfg.estimate = seeded ? null : result.estimate;
      } else {
        cfg.estimate = null;
      }
    } finally {
      cfg.estimating = false;
      cfg.lastSyncKey = key;
    }
  }
}

watch(
  [mode, globalFormat, drafts],
  () => {
    if (mode.value === 'compress') scheduleEstimateSync();
  },
  { deep: true },
);

watch(
  jobs,
  (list) => {
    for (const job of list) {
      if (
        job.status !== 'completed' &&
        job.status !== 'failed' &&
        job.status !== 'cancelled' &&
        !beforeIds.has(job.id)
      ) {
        batchIds.add(job.id);
      }
    }
    if (completion.value === null) return;
    const relevant = list.filter((job) => batchIds.has(job.id));
    if (relevant.length === 0) return;
    const hasActive = relevant.some(
      (job) => job.status === 'pending' || job.status === 'processing',
    );
    if (hasActive) return;
    const anyCompleted = relevant.some((job) => job.status === 'completed');
    const anyFailed = relevant.some((job) => job.status === 'failed' || job.status === 'cancelled');
    const { hadIncompatible, compressed } = completion.value;
    completion.value = null;
    beforeIds.clear();
    batchIds.clear();
    if (anyCompleted && !anyFailed && !hadIncompatible) {
      banner.value = {
        kind: 'info',
        text: compressed
          ? 'Arquivos comprimidos com sucesso. Os arquivos estão na pasta Convertidos, junto aos arquivos originais.'
          : 'Arquivos convertidos com sucesso. Os arquivos estão na pasta Convertidos, junto aos arquivos originais.',
      };
    }
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (estimateTimer) clearTimeout(estimateTimer);
});
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-4xl flex-col gap-4 p-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-ink">Media Converter</h1>
        <p v-if="appInfo" class="text-xs text-ink-dim">
          v{{ appInfo.appVersion }} · {{ appInfo.platform }} {{ appInfo.arch }}
        </p>
      </div>
    </header>

    <div
      v-if="banner"
      class="rounded-lg border px-3 py-2 text-sm"
      :class="
        banner.kind === 'error'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          : 'border-edge bg-surface-raised text-ink-dim'
      "
    >
      {{ banner.text }}
    </div>

    <DropZone @added="addDrafts" />

    <template v-if="drafts.length > 0 || jobs.length > 0">
      <div v-if="drafts.length > 0" class="flex flex-col gap-3">
        <div class="flex flex-col gap-3 rounded-xl border border-edge bg-surface-alt p-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-ink-dim">Modo:</span>
            <button
              type="button"
              :class="segBtnClass(mode === 'convert')"
              @click="mode = 'convert'"
            >
              Conversão
            </button>
            <button
              type="button"
              :class="segBtnClass(mode === 'compress')"
              @click="mode = 'compress'"
            >
              Compressão
            </button>
          </div>

          <div v-if="mode === 'convert'" class="flex flex-wrap items-center gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <label for="global-format" class="shrink-0 text-sm text-ink-dim">
                Converter todos para:
              </label>
              <select
                id="global-format"
                class="shrink-0 cursor-pointer rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
                :value="globalFormat"
                @change="globalFormat = ($event.target as HTMLSelectElement).value as TargetFormat"
              >
                <optgroup
                  v-for="category in Object.keys(FORMATS_BY_CATEGORY) as Array<
                    'audio' | 'video' | 'image'
                  >"
                  :key="category"
                  :label="categoryLabel[category]"
                >
                  <option
                    v-for="format in FORMATS_BY_CATEGORY[category]"
                    :key="format.id"
                    :value="format.id"
                  >
                    {{ format.label }}
                  </option>
                </optgroup>
              </select>
            </div>

            <button
              type="button"
              :disabled="converting || compatibleCount() === 0"
              class="shrink-0 cursor-pointer rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              @click="convertAll"
            >
              {{ actionLabel }}
            </button>
          </div>

          <div v-else class="flex flex-col gap-2">
            <p class="text-xs text-ink-dim">
              Cada arquivo tem a própria configuração de compressão. Defina o tamanho máximo de cada
              arquivo na lista abaixo.
            </p>
            <div class="flex justify-end">
              <button
                type="button"
                :disabled="converting || compressReadyCount() === 0"
                class="shrink-0 cursor-pointer rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                @click="convertAll"
              >
                {{ actionLabel }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
            @click="removeAllDrafts"
          >
            Remover todos
          </button>
        </div>
      </div>

      <DraftList
        v-if="drafts.length > 0 && mode === 'convert'"
        :items="drafts"
        :global-format="globalFormat"
        @remove="removeDraft"
      />

      <CompressionDraftList
        v-else-if="drafts.length > 0 && mode === 'compress'"
        :items="drafts"
        :global-format="globalFormat"
        @remove="removeDraft"
        @update-config="updateConfig"
      />

      <QueueList
        v-if="jobs.length > 0"
        :jobs="jobs"
        :message-for="messageFor"
        @cancel="cancelJob"
      />

      <div v-if="hasTerminalJobs()" class="flex justify-end">
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
          @click="clearCompleted"
        >
          Limpar concluídos
        </button>
      </div>
    </template>

    <footer v-else class="mt-2 text-center text-xs text-ink-dim">
      Nenhum arquivo adicionado ainda.
    </footer>
  </div>
</template>
