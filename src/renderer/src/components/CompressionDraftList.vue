<script setup lang="ts">
import { computed } from 'vue';
import type { MediaCategory } from '@shared/types';
import type { CompressionDraftConfig, CompressDraft } from '../types';
import { isCompressionReady } from '../compression-ui';
import {
  CATEGORY_LABELS,
  CATEGORY_PLURAL,
  CATEGORY_SINGULAR,
  countLabel,
  groupByCategory,
} from '../grouping';
import CompressionDraftCard from './CompressionDraftCard.vue';

const props = defineProps<{ items: CompressDraft[]; converting: boolean }>();
const emit = defineEmits<{
  remove: [id: string];
  updateConfig: [id: string, patch: Partial<Pick<CompressionDraftConfig, 'maxSizeRaw'>>];
  compress: [category: MediaCategory];
}>();

const groups = computed(() => groupByCategory(props.items));

const categoryReadyCounts = computed<Record<MediaCategory, number>>(() => {
  const counts: Record<MediaCategory, number> = { video: 0, audio: 0, image: 0 };
  for (const item of props.items) {
    if (isCompressionReady(item.category, item.extension, item.compression, item.sizeBytes)) {
      counts[item.category] += 1;
    }
  }
  return counts;
});

function actionLabel(category: MediaCategory, count: number): string {
  const noun = count === 1 ? CATEGORY_SINGULAR[category] : CATEGORY_PLURAL[category];
  return `Comprimir ${count} ${noun}`;
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between px-1">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">
        Compressão por arquivo
      </h2>
      <span class="text-xs text-ink-dim">{{ countLabel(items.length) }}</span>
    </div>

    <p class="px-1 text-xs text-ink-dim">
      Cada arquivo é comprimido mantendo o próprio formato original (ex.: MP4 -> MP4, MP3 -> MP3, JPG
      -> JPG). Defina o tamanho máximo de cada arquivo abaixo.
    </p>

    <div v-for="group in groups" :key="group.category" class="flex flex-col gap-1.5">
      <div class="flex items-baseline gap-2 px-1">
        <h3 class="text-sm font-semibold text-ink">{{ CATEGORY_LABELS[group.category] }}</h3>
        <span class="text-xs text-ink-dim">{{ countLabel(group.entries.length) }}</span>
      </div>

      <div class="overflow-hidden rounded-xl border border-edge bg-surface-alt">
        <div class="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-2.5">
          <button
            type="button"
            :disabled="props.converting || categoryReadyCounts[group.category] === 0"
            class="ml-auto shrink-0 cursor-pointer rounded-md border border-accent bg-surface-raised px-4 py-1 text-sm font-medium text-ink transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            @click="emit('compress', group.category)"
          >
            {{ actionLabel(group.category, categoryReadyCounts[group.category]) }}
          </button>
        </div>

        <ul class="divide-y divide-edge">
          <CompressionDraftCard
            v-for="entry in group.entries"
            :key="entry.item.id"
            :item="entry.item"
            @remove="(id) => emit('remove', id)"
            @update-max="(id, value) => emit('updateConfig', id, { maxSizeRaw: value })"
          />
        </ul>
      </div>
    </div>
  </section>
</template>