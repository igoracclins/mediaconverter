<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import DropZone from './components/DropZone.vue';
import DraftList from './components/DraftList.vue';
import CompressionDraftList from './components/CompressionDraftList.vue';
import QueueList from './components/QueueList.vue';
import { useQueue } from './composables/useQueue';
import { TARGET_FORMAT_MAP } from '@shared/formats';
import type { ConversionRequestItem } from '@shared/ipc';
import { parseTargetSizeMb } from '@conversion/compress';
import { initialSizeMb, maxSizeWithinLimit } from './compression-ui';
import type { CompressionDraftConfig, DraftItem } from './types';
import type { MediaCategory, QualityPreset, TargetFormat } from '@shared/types';
import { userMessage } from '@shared/errors';
import { keepFormatFor, isLosslessFormat } from './compression-format';

interface CompressionTarget {
  format: TargetFormat;
  label: string;
  lossless: boolean;
}

function compressionTargetFor(item: DraftItem): CompressionTarget | null {
  const format = keepFormatFor(item.category, item.extension);
  if (!format) return null;
  return {
    format,
    label: TARGET_FORMAT_MAP[format].label,
    lossless: isLosslessFormat(format),
  };
}

const { appInfo, jobs, messageFor } = useQueue();

const drafts = ref<DraftItem[]>([]);
const converting = ref(false);
const banner = ref<{ kind: 'error' | 'info'; text: string } | null>(null);

const formatsByCategory = ref<Record<MediaCategory, TargetFormat>>({
  video: 'mp4',
  audio: 'mp3',
  image: 'jpg',
});

const mode = ref<'convert' | 'compress'>('convert');

const beforeIds = new Set<string>();
const batchIds = new Set<string>();
const completion = ref<{ hadIncompatible: boolean; compressed: boolean } | null>(null);

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
    if (added > 0) scheduleEstimateSync();
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
  if (cfg) {
    Object.assign(cfg, patch);
    scheduleEstimateSync();
  }
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

function setCategoryFormat(category: MediaCategory, format: TargetFormat): void {
  formatsByCategory.value[category] = format;
}

async function convertCategory(category: MediaCategory): Promise<void> {
  if (converting.value) return;
  const categoryDrafts = drafts.value.filter((d) => d.category === category);
  if (categoryDrafts.length === 0) return;

  converting.value = true;
  banner.value = null;
  const format = formatsByCategory.value[category];
  const items: ConversionRequestItem[] = categoryDrafts.map((d) => ({
    inputPath: d.path,
    targetFormat: format,
    quality: 'high' as QualityPreset,
  }));
  const submitted = new Set(items.map((item) => item.inputPath));
  for (const job of jobs.value) beforeIds.add(job.id);
  try {
    const result = await window.api.startConversion({
      items,
      destination: null,
    });
    if (result.ok) {
      completion.value = { hadIncompatible: false, compressed: false };
      drafts.value = drafts.value.filter((d) => !submitted.has(d.path));
    } else {
      banner.value = { kind: 'error', text: userMessage(result.error) };
    }
  } finally {
    converting.value = false;
  }
}

async function compressCategory(category: MediaCategory): Promise<void> {
  if (converting.value) return;
  const categoryDrafts = drafts.value.filter((d) => d.category === category);
  if (categoryDrafts.length === 0) return;

  converting.value = true;
  banner.value = null;
  const items: ConversionRequestItem[] = [];
  for (const d of categoryDrafts) {
    const cfg = d.compression;
    if (!cfg) continue;
    const target = compressionTargetFor(d);
    if (!target || target.lossless) continue;
    const maxSizeMb = parseTargetSizeMb(cfg.maxSizeRaw);
    if (maxSizeMb === null) continue;
    if (!maxSizeWithinLimit(cfg.maxSizeRaw, d.sizeBytes)) continue;
    items.push({
      inputPath: d.path,
      targetFormat: target.format,
      quality: 'high' as QualityPreset,
      compression: { maxSizeMb },
    });
  }
  const submitted = new Set(items.map((item) => item.inputPath));
  for (const job of jobs.value) beforeIds.add(job.id);
  try {
    const result =
      items.length > 0
        ? await window.api.startConversion({
            items,
            destination: null,
          })
        : {
            ok: true as const,
            created: 0,
            rejected: [] as { inputPath: string; error: string }[],
          };
    if (result.ok) {
      completion.value = { hadIncompatible: false, compressed: true };
      drafts.value = drafts.value.filter((d) => !submitted.has(d.path));
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
  for (let round = 0; round < 2; round++) {
    let changed = false;
    for (const draft of drafts.value) {
      const cfg = draft.compression;
      if (!cfg) continue;
      const target = compressionTargetFor(draft);
      if (!target || target.lossless) continue;
      const key = `${cfg.maxSizeRaw}`;
      if (cfg.estimating || cfg.lastSyncKey === key) continue;
      const maxMb = parseTargetSizeMb(cfg.maxSizeRaw);
      const probe = maxMb ?? 1;
      cfg.estimating = true;
      changed = true;
      try {
        const result = await window.api.estimateCompression({
          inputPath: draft.path,
          targetFormat: target.format,
          maxSizeMb: probe,
        });
        let seeded = false;
        if (result.ok) {
          if (maxMb === null && cfg.maxSizeRaw.trim() === '') {
            const seededMb = initialSizeMb({
              sizeBytes: draft.sizeBytes,
              recommendedMinMb: result.estimate.recommendedMinMb,
              hardMinMb: result.estimate.hardMinMb,
            });
            if (seededMb !== null) {
              cfg.maxSizeRaw = String(seededMb);
              seeded = true;
            }
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
    if (!changed) break;
  }
}

watch(mode, () => {
  if (mode.value === 'compress') scheduleEstimateSync();
});

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

scheduleEstimateSync();

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
          v{{ appInfo.appVersion }} {{ appInfo.platform }} {{ appInfo.arch }}
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

          <div v-if="mode === 'compress'" class="flex flex-col gap-2">
            <p class="text-xs text-ink-dim">
              Cada arquivo tem a própria configuração de compressão. Defina o tamanho máximo de cada
              arquivo na lista abaixo.
            </p>
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
        :formats="formatsByCategory"
        :converting="converting"
        @remove="removeDraft"
        @set-format="setCategoryFormat"
        @convert="convertCategory"
      />

      <CompressionDraftList
        v-else-if="drafts.length > 0 && mode === 'compress'"
        :items="drafts"
        :converting="converting"
        @remove="removeDraft"
        @update-config="updateConfig"
        @compress="compressCategory"
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
