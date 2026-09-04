<script setup lang="ts">
import { computed } from 'vue';
import { TARGET_FORMAT_MAP } from '@shared/formats';
import type { MediaCategory, TargetFormat } from '@shared/types';
import type { CompressionDraftConfig, DraftItem } from '../types';
import { compressionHint, formatMb, parseMaxMb, type HintKind } from '../compression-ui';
import { keepFormatFor, isLosslessFormat } from '../compression-format';

const props = defineProps<{ items: DraftItem[]; converting: boolean }>();
const emit = defineEmits<{
  remove: [index: number];
  updateConfig: [index: number, patch: Partial<Pick<CompressionDraftConfig, 'maxSizeRaw'>>];
  compress: [category: MediaCategory];
}>();

const CATEGORY_ORDER: MediaCategory[] = ['video', 'audio', 'image'];

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  video: 'Vídeos',
  audio: 'Áudios',
  image: 'Imagens',
};

const CATEGORY_SINGULAR: Record<MediaCategory, string> = {
  video: 'vídeo',
  audio: 'áudio',
  image: 'imagem',
};

const CATEGORY_PLURAL: Record<MediaCategory, string> = {
  video: 'vídeos',
  audio: 'áudios',
  image: 'imagens',
};

const groups = computed<
  { category: MediaCategory; entries: { item: DraftItem; index: number }[] }[]
>(() => {
  return CATEGORY_ORDER.map((category) => {
    const entries: { item: DraftItem; index: number }[] = [];
    props.items.forEach((item, index) => {
      if (item.category === category) entries.push({ item, index });
    });
    return { category, entries };
  }).filter((group) => group.entries.length > 0);
});

function targetFor(item: DraftItem): TargetFormat | null {
  return keepFormatFor(item.category, item.extension);
}

function isLossless(item: DraftItem): boolean {
  const format = targetFor(item);
  return format !== null && isLosslessFormat(format);
}

function isCompressible(item: DraftItem): boolean {
  return targetFor(item) !== null && !isLossless(item);
}

function isReady(item: DraftItem): boolean {
  if (!isCompressible(item)) return false;
  const cfg = config(item);
  return cfg !== undefined && parseMaxMb(cfg.maxSizeRaw) !== null;
}

function categoryReadyCount(category: MediaCategory): number {
  return props.items.filter((item) => item.category === category && isReady(item)).length;
}

function actionLabel(category: MediaCategory, count: number): string {
  const noun = count === 1 ? CATEGORY_SINGULAR[category] : CATEGORY_PLURAL[category];
  return `Comprimir ${count} ${noun}`;
}

function formatLabel(item: DraftItem): string | null {
  const format = targetFor(item);
  return format ? TARGET_FORMAT_MAP[format].label : null;
}

function config(item: DraftItem): CompressionDraftConfig | undefined {
  return item.compression;
}

function sizeText(item: DraftItem): string | null {
  const estimate = config(item)?.estimate;
  return estimate && estimate.currentSizeMb > 0 ? formatMb(estimate.currentSizeMb) : null;
}

function hintFor(item: DraftItem): { kind: HintKind; text: string } | null {
  const cfg = config(item);
  if (!cfg) return null;
  if (isLossless(item)) {
    return {
      kind: 'warning',
      text: `O formato ${formatLabel(item)} é sem perdas: ele não reduz o tamanho sob demanda mantendo o formato original.`,
    };
  }
  if (!isCompressible(item)) {
    return {
      kind: 'warning',
      text: 'Não é possível comprimir este arquivo mantendo o formato original.',
    };
  }
  if (parseMaxMb(cfg.maxSizeRaw) === null) {
    return cfg.maxSizeRaw.trim() === ''
      ? { kind: 'info', text: 'Defina um tamanho máximo (em MB) para este arquivo.' }
      : { kind: 'error', text: 'Informe um tamanho máximo maior que zero (em MB).' };
  }
  return compressionHint(cfg.estimate, formatLabel(item) ?? '');
}

function onTarget(index: number, event: Event): void {
  emit('updateConfig', index, { maxSizeRaw: (event.target as HTMLInputElement).value });
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
}

function hintClass(kind: HintKind): string {
  return kind === 'error' ? 'text-danger' : kind === 'warning' ? 'text-amber-300' : 'text-ink-dim';
}
</script>

<template>
  <section>
    <div class="mb-2 flex items-baseline justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">
        Compressão por arquivo
      </h2>
      <span class="text-xs text-ink-dim">
        {{ items.length }} {{ items.length === 1 ? 'arquivo' : 'arquivos' }}
      </span>
    </div>

    <p class="mb-3 px-1 text-xs text-ink-dim">
      Cada arquivo é comprimido mantendo o próprio formato original (ex.: MP4 → MP4, MP3 → MP3, JPG
      → JPG). Defina o tamanho máximo de cada arquivo abaixo.
    </p>

    <div v-for="group in groups" :key="group.category" class="mb-3">
      <div class="mb-1.5 flex items-baseline gap-2 px-1">
        <h3 class="text-sm font-semibold text-ink">{{ CATEGORY_LABELS[group.category] }}</h3>
        <span class="text-xs text-ink-dim">
          {{ group.entries.length }} {{ group.entries.length === 1 ? 'arquivo' : 'arquivos' }}
        </span>
      </div>

      <ul class="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface-alt">
        <li
          v-for="entry in group.entries"
          :key="`${entry.item.path}:${entry.index}`"
          class="flex flex-col gap-3 px-4 py-2.5"
        >
          <div class="flex items-center gap-3">
            <span
              class="w-16 shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-dim"
            >
              {{ entry.item.extension }}
            </span>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-ink" :title="entry.item.path">
                {{ entry.item.name }}
              </p>
              <p class="text-xs text-ink-dim">
                <template v-if="sizeText(entry.item)">
                  Tamanho atual: {{ sizeText(entry.item) }}
                </template>
                <template v-else-if="!isCompressible(entry.item)">
                  Mantém o formato {{ formatLabel(entry.item) || entry.item.extension }}.
                </template>
              </p>
            </div>

            <button
              type="button"
              class="shrink-0 rounded-md px-2 py-1 text-sm text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
              :title="`Remover ${entry.item.name}`"
              @click="emit('remove', entry.index)"
            >
              ✕
            </button>
          </div>

          <template v-if="isCompressible(entry.item)">
            <div class="flex flex-wrap items-center gap-3">
              <label class="flex flex-col gap-1 text-sm text-ink-dim">
                Tamanho máximo
                <span class="flex items-center gap-2">
                  <input
                    :value="config(entry.item)?.maxSizeRaw ?? ''"
                    type="number"
                    min="0.5"
                    step="0.5"
                    inputmode="decimal"
                    class="w-24 rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
                    @input="onTarget(entry.index, $event)"
                    @wheel="onWheel"
                  />
                  <span class="text-sm font-medium text-ink">MB</span>
                </span>
              </label>
            </div>

            <p
              v-if="hintFor(entry.item)"
              class="text-xs"
              :class="hintClass(hintFor(entry.item)!.kind)"
            >
              {{ hintFor(entry.item)!.text }}
            </p>
          </template>
          <template v-else>
            <p
              v-if="hintFor(entry.item)"
              class="text-xs"
              :class="hintClass(hintFor(entry.item)!.kind)"
            >
              {{ hintFor(entry.item)!.text }}
            </p>
          </template>
        </li>
      </ul>

      <div class="mt-3 flex flex-col gap-3 rounded-xl border border-edge bg-surface-alt p-3">
        <button
          type="button"
          :disabled="props.converting || categoryReadyCount(group.category) === 0"
          class="shrink-0 cursor-pointer rounded-md border border-accent bg-surface-raised px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          @click="emit('compress', group.category)"
        >
          {{ actionLabel(group.category, categoryReadyCount(group.category)) }}
        </button>
      </div>
    </div>
  </section>
</template>
