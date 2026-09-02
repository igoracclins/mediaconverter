<script setup lang="ts">
import { computed } from 'vue';
import { TARGET_FORMAT_MAP } from '@shared/formats';
import type { TargetFormat } from '@shared/types';
import type { DraftItem } from '../types';

const props = defineProps<{ items: DraftItem[]; globalFormat: TargetFormat }>();
const emit = defineEmits<{ remove: [index: number] }>();

const totals = computed(() => {
  const total = props.items.length;
  const kinds: Record<string, number> = {};
  for (const item of props.items) {
    kinds[item.category] = (kinds[item.category] ?? 0) + 1;
  }
  return { total, kinds };
});

const globalCategory = computed(() => TARGET_FORMAT_MAP[props.globalFormat].category);

function compatibleWithGlobal(item: DraftItem): boolean {
  return item.category === globalCategory.value;
}
</script>

<template>
  <section>
    <div class="mb-2 flex items-baseline justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">
        Prontos para converter
      </h2>
      <span class="text-xs text-ink-dim">
        {{ totals.total }} {{ totals.total === 1 ? 'arquivo' : 'arquivos' }}
        <template v-for="(count, category) in totals.kinds" :key="category">
          · {{ count }}
          {{ category === 'audio' ? 'áudio' : category === 'video' ? 'vídeo' : 'imagem' }}
        </template>
      </span>
    </div>

    <ul class="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface-alt">
      <li
        v-for="(item, index) in items"
        :key="`${item.path}:${index}`"
        class="flex items-center gap-3 px-4 py-2.5"
        :class="compatibleWithGlobal(item) ? '' : 'opacity-60'"
      >
        <span
          class="w-16 shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-dim"
        >
          {{ item.extension }}
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-ink" :title="item.path">{{ item.name }}</p>
          <p v-if="!compatibleWithGlobal(item)" class="text-xs text-ink-dim">
            Incompatível com {{ TARGET_FORMAT_MAP[globalFormat].label }}
          </p>
        </div>

        <button
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
          :title="`Remover ${item.name}`"
          @click="emit('remove', index)"
        >
          ✕
        </button>
      </li>
    </ul>
  </section>
</template>
