<script setup lang="ts">
import { computed } from 'vue';
import type { CompressDraft } from '../types';
import {
  compressTargetFor,
  formatMb,
  maxSizeValidation,
  minimumAllowedMb,
  originalSizeMb,
  sanitizeSizeInput,
  type MaxSizeIssue,
} from '../compression-ui';

const props = defineProps<{ item: CompressDraft }>();
const emit = defineEmits<{
  remove: [id: string];
  updateMax: [id: string, value: string];
}>();

function messageFor(issue: MaxSizeIssue | null, sizeBytes: number): { kind: 'error' | 'info'; text: string } | null {
  switch (issue) {
    case 'empty':
      return { kind: 'info', text: 'Defina um tamanho máximo (em MB) para este arquivo.' };
    case 'not-number':
      return { kind: 'error', text: 'Informe um tamanho máximo numérico (em MB).' };
    case 'not-below-original':
      return { kind: 'error', text: 'O tamanho máximo precisa ser menor que o tamanho original do arquivo.' };
    case 'below-minimum':
      return {
        kind: 'error',
        text: `O limite informado é muito baixo para este arquivo. Tamanho mínimo permitido: ${formatMb(minimumAllowedMb(sizeBytes))}.`,
      };
    default:
      return null;
  }
}

const view = computed(() => {
  const item = props.item;
  const cfg = item.compression;
  const target = compressTargetFor(item.category, item.extension);
  const compressible = target !== null && !target.lossless;
  const label = target?.label ?? null;
  const originalSize = originalSizeMb(item.sizeBytes);
  const sizeText = originalSize !== null ? formatMb(originalSize) : null;
  const raw = cfg.maxSizeRaw;
  const validation = maxSizeValidation(raw, item.sizeBytes);
  let hint: { kind: 'error' | 'info' | 'warning'; text: string } | null = null;
  if (!compressible) {
    hint = {
      kind: 'warning',
      text: target
        ? `O formato ${label} é sem perdas: ele não reduz o tamanho sob demanda mantendo o formato original.`
        : 'Não é possível comprimir este arquivo mantendo o formato original.',
    };
  } else {
    hint = messageFor(validation.issue, item.sizeBytes);
  }
  return { label, sizeText, compressible, raw, hint };
});

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = sanitizeSizeInput(input.value);
  input.value = value;
  emit('updateMax', props.item.id, value);
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
}

function hintClass(kind: 'error' | 'warning' | 'info'): string {
  return kind === 'error' ? 'text-danger' : kind === 'warning' ? 'text-amber-300' : 'text-ink-dim';
}
</script>

<template>
  <li class="flex flex-col gap-3 px-4 py-2.5">
    <div class="flex items-center gap-3">
      <span
        class="w-16 shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-dim"
      >
        {{ item.extension }}
      </span>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-ink" :title="item.path">
          {{ item.name }}
        </p>
        <p class="text-xs text-ink-dim">
          <template v-if="view.sizeText">
            Tamanho atual: {{ view.sizeText }}
          </template>
          <template v-else-if="!view.compressible">
            Mantém o formato {{ view.label || item.extension }}.
          </template>
        </p>
      </div>

      <button
        type="button"
        class="shrink-0 rounded-md px-2 py-1 text-sm text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
        :title="`Remover ${item.name}`"
        @click="emit('remove', item.id)"
      >
        ✕
      </button>
    </div>

    <template v-if="view.compressible">
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex flex-col gap-1 text-sm text-ink-dim">
          Tamanho máximo
          <span class="flex items-center gap-2">
            <input
              :value="view.raw"
              type="text"
              placeholder="0,00"
              inputmode="decimal"
              class="w-24 rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
              @input="onInput"
              @wheel="onWheel"
            />
            <span class="text-sm font-medium text-ink">MB</span>
          </span>
        </label>
      </div>
    </template>

    <p v-if="view.hint" class="text-xs" :class="hintClass(view.hint.kind)">
      {{ view.hint.text }}
    </p>
  </li>
</template>