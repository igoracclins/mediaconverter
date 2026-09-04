<script setup lang="ts">
import { computed } from 'vue';
import { FORMATS_BY_CATEGORY } from '@shared/formats';
import type { MediaCategory, TargetFormat } from '@shared/types';
import type { DraftItem } from '../types';

const props = defineProps<{
  items: DraftItem[];
  formats: Record<MediaCategory, TargetFormat>;
  converting: boolean;
}>();
const emit = defineEmits<{
  remove: [index: number];
  setFormat: [category: MediaCategory, format: TargetFormat];
  convert: [category: MediaCategory];
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

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'arquivo' : 'arquivos'}`;
}

function actionLabel(category: MediaCategory, count: number): string {
  const noun = count === 1 ? CATEGORY_SINGULAR[category] : CATEGORY_PLURAL[category];
  return `Converter ${count} ${noun}`;
}
</script>

<template>
  <section>
    <div class="mb-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">
        Prontos para converter
      </h2>
    </div>

    <div v-for="group in groups" :key="group.category" class="mb-5">
      <div class="mb-1.5 flex items-baseline gap-2 px-1">
        <h3 class="text-sm font-semibold text-ink">{{ CATEGORY_LABELS[group.category] }}</h3>
        <span class="text-xs text-ink-dim">{{ countLabel(group.entries.length) }}</span>
      </div>

      <div class="flex flex-col gap-3 rounded-xl border border-edge bg-surface-alt p-3">
        <div class="flex min-w-0 items-center gap-2">
          <label :for="`convert-format-${group.category}`" class="shrink-0 text-sm text-ink-dim">
            Converter todos para:
          </label>
          <select
            :id="`convert-format-${group.category}`"
            class="shrink-0 cursor-pointer rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
            :value="formats[group.category]"
            @change="
              emit(
                'setFormat',
                group.category,
                ($event.target as HTMLSelectElement).value as TargetFormat,
              )
            "
          >
            <option
              v-for="format in FORMATS_BY_CATEGORY[group.category]"
              :key="format.id"
              :value="format.id"
            >
              {{ format.label }}
            </option>
          </select>
        </div>

        <button
          type="button"
          :disabled="converting"
          class="shrink-0 cursor-pointer rounded-md border border-accent bg-surface-raised px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          @click="emit('convert', group.category)"
        >
          {{ actionLabel(group.category, group.entries.length) }}
        </button>
      </div>

      <ul class="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface-alt">
        <li
          v-for="entry in group.entries"
          :key="`${entry.item.path}:${entry.index}`"
          class="flex items-center gap-3 px-4 py-2.5"
        >
          <span
            class="w-16 shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-dim"
          >
            {{ entry.item.extension }}
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-ink" :title="entry.item.path">{{ entry.item.name }}</p>
          </div>

          <button
            type="button"
            class="shrink-0 rounded-md px-2 py-1 text-sm text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
            :title="`Remover ${entry.item.name}`"
            @click="emit('remove', entry.index)"
          >
            ✕
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
