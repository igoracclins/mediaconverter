<script setup lang="ts">
import { computed } from 'vue';
import type { MediaCategory, TargetFormat } from '@shared/types';
import type { CompressionDraftConfig, DraftItem } from '../types';
import { maxSizeWithinLimit, parseMaxMb } from '../compression-ui';
import { keepFormatFor, isLosslessFormat } from '../compression-format';
import CompressionDraftCard from './CompressionDraftCard.vue';

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
  const cfg = item.compression;
  if (cfg === undefined) return false;
  const maxMb = parseMaxMb(cfg.maxSizeRaw);
  if (maxMb === null) return false;
  return maxSizeWithinLimit(cfg.maxSizeRaw, item.sizeBytes);
}

const categoryReadyCounts = computed<Record<MediaCategory, number>>(() => {
  const counts: Record<MediaCategory, number> = { video: 0, audio: 0, image: 0 };
  for (const item of props.items) {
    if (isReady(item)) counts[item.category] += 1;
  }
  return counts;
});

function actionLabel(category: MediaCategory, count: number): string {
  const noun = count === 1 ? CATEGORY_SINGULAR[category] : CATEGORY_PLURAL[category];
  return `Comprimir ${count} ${noun}`;
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
      Cada arquivo é comprimido mantendo o próprio formato original (ex.: MP4 -> MP4, MP3 -> MP3, JPG
      -> JPG). Defina o tamanho máximo de cada arquivo abaixo.
    </p>

    <div v-for="group in groups" :key="group.category" class="mb-3">
      <div class="mb-1.5 flex items-baseline gap-2 px-1">
        <h3 class="text-sm font-semibold text-ink">{{ CATEGORY_LABELS[group.category] }}</h3>
        <span class="text-xs text-ink-dim">
          {{ group.entries.length }} {{ group.entries.length === 1 ? 'arquivo' : 'arquivos' }}
        </span>
      </div>

      <ul class="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface-alt">
        <CompressionDraftCard
          v-for="entry in group.entries"
          :key="`${entry.item.path}:${entry.index}`"
          :item="entry.item"
          :index="entry.index"
          @remove="(index) => emit('remove', index)"
          @update-max="(index, value) => emit('updateConfig', index, { maxSizeRaw: value })"
        />
      </ul>

      <div class="mt-3 flex flex-col gap-3 rounded-xl border border-edge bg-surface-alt p-3">
        <button
          type="button"
          :disabled="props.converting || categoryReadyCounts[group.category] === 0"
          class="shrink-0 cursor-pointer rounded-md border border-accent bg-surface-raised px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          @click="emit('compress', group.category)"
        >
          {{ actionLabel(group.category, categoryReadyCounts[group.category]) }}
        </button>
      </div>
    </div>
  </section>
</template>
