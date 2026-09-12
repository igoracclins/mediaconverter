<script setup lang="ts">
import { computed } from 'vue';
import { FORMATS_BY_CATEGORY } from '@shared/formats';
import type { AudioTargetFormat } from '@shared/types';
import type { ExtractDraft } from '../types';
import {
  CATEGORY_LABELS,
  CATEGORY_PLURAL,
  CATEGORY_SINGULAR,
  countLabel,
  groupByCategory,
} from '../grouping';

const props = defineProps<{
  items: ExtractDraft[];
  targetFormat: AudioTargetFormat;
  converting: boolean;
}>();
const emit = defineEmits<{
  remove: [id: string];
  setFormat: [format: AudioTargetFormat];
  extract: [];
}>();

const groups = computed(() => groupByCategory(props.items));

function actionLabel(count: number): string {
  const noun = count === 1 ? CATEGORY_SINGULAR.video : CATEGORY_PLURAL.video;
  return `Extrair áudio de ${count} ${noun}`;
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between px-1">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">Prontos para extrair</h2>
      <span class="text-xs text-ink-dim">{{ countLabel(items.length) }}</span>
    </div>

    <div v-for="group in groups" :key="group.category" class="flex flex-col gap-1.5">
      <div class="flex items-baseline gap-2 px-1">
        <h3 class="text-sm font-semibold text-ink">{{ CATEGORY_LABELS[group.category] }}</h3>
        <span class="text-xs text-ink-dim">{{ countLabel(group.entries.length) }}</span>
      </div>

      <div class="overflow-hidden rounded-xl border border-edge bg-surface-alt">
        <div class="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-2.5">
          <label for="extract-audio-format" class="shrink-0 text-sm text-ink-dim">
            Extrair áudio para:
          </label>
          <select
            id="extract-audio-format"
            class="shrink-0 cursor-pointer rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
            :value="props.targetFormat"
            @change="
              emit(
                'setFormat',
                ($event.target as HTMLSelectElement).value as AudioTargetFormat,
              )
            "
          >
            <option v-for="format in FORMATS_BY_CATEGORY.audio" :key="format.id" :value="format.id">
              {{ format.label }}
            </option>
          </select>

          <button
            type="button"
            :disabled="props.converting"
            class="ml-auto shrink-0 cursor-pointer rounded-md border border-accent bg-surface-raised px-4 py-1 text-sm font-medium text-ink transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            @click="emit('extract')"
          >
            {{ actionLabel(group.entries.length) }}
          </button>
        </div>

        <ul class="divide-y divide-edge">
          <li
            v-for="entry in group.entries"
            :key="entry.item.id"
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
              @click="emit('remove', entry.item.id)"
            >
              ✕
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>