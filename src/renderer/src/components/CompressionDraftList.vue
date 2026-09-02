<script setup lang="ts">
import { computed } from 'vue';
import { TARGET_FORMAT_MAP } from '@shared/formats';
import type { TargetFormat } from '@shared/types';
import type { CompressionDraftConfig, DraftItem } from '../types';
import { compressionHint, formatMb, parseMaxMb, type HintKind } from '../compression-ui';

const props = defineProps<{ items: DraftItem[]; globalFormat: TargetFormat }>();
const emit = defineEmits<{
  remove: [index: number];
  updateConfig: [index: number, patch: Partial<Pick<CompressionDraftConfig, 'maxSizeRaw'>>];
}>();

const globalCategory = computed(() => TARGET_FORMAT_MAP[props.globalFormat].category);
const globalLabel = computed(() => TARGET_FORMAT_MAP[props.globalFormat].label);

function compatible(item: DraftItem): boolean {
  return item.category === globalCategory.value;
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
  if (parseMaxMb(cfg.maxSizeRaw) === null) {
    return cfg.maxSizeRaw.trim() === ''
      ? { kind: 'info', text: 'Defina um tamanho máximo (em MB) para este arquivo.' }
      : { kind: 'error', text: 'Informe um tamanho máximo maior que zero (em MB).' };
  }
  return compressionHint(cfg.estimate, globalLabel.value);
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

    <ul class="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface-alt">
      <li
        v-for="(item, index) in items"
        :key="`${item.path}:${index}`"
        class="flex flex-col gap-3 px-4 py-2.5"
        :class="compatible(item) ? '' : 'opacity-60'"
      >
        <div class="flex items-center gap-3">
          <span
            class="w-16 shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-dim"
          >
            {{ item.extension }}
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-ink" :title="item.path">{{ item.name }}</p>
            <p class="text-xs text-ink-dim">
              <template v-if="sizeText(item)"> Tamanho atual: {{ sizeText(item) }} </template>
              <template v-else-if="!compatible(item)">
                Não é possível comprimir para {{ globalLabel }}.
              </template>
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
        </div>

        <template v-if="compatible(item)">
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex flex-col gap-1 text-sm text-ink-dim">
              Tamanho máximo
              <span class="flex items-center gap-2">
                <input
                  :value="config(item)?.maxSizeRaw ?? ''"
                  type="number"
                  min="0.5"
                  step="0.5"
                  inputmode="decimal"
                  class="w-24 rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
                  @input="onTarget(index, $event)"
                  @wheel="onWheel"
                />
                <span class="text-sm font-medium text-ink">MB</span>
              </span>
            </label>
          </div>

          <p v-if="hintFor(item)" class="text-xs" :class="hintClass(hintFor(item)!.kind)">
            {{ hintFor(item)!.text }}
          </p>
        </template>
      </li>
    </ul>
  </section>
</template>
