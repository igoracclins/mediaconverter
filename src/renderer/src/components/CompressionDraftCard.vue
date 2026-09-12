<script setup lang="ts">
import { computed } from 'vue';
import type { CompressDraft } from '../types';
import {
  compressTargetFor,
  compressionHint,
  formatMb,
  originalSizeMb,
  parseMaxMb,
  type HintKind,
} from '../compression-ui';

const props = defineProps<{ item: CompressDraft }>();
const emit = defineEmits<{
  remove: [id: string];
  updateMax: [id: string, value: string];
}>();

const view = computed(() => {
  const item = props.item;
  const cfg = item.compression;
  const target = compressTargetFor(item.category, item.extension);
  const compressible = target !== null && !target.lossless;
  const label = target?.label ?? null;
  const estimate = cfg.estimate;
  const sizeText = estimate && estimate.currentSizeMb > 0 ? formatMb(estimate.currentSizeMb) : null;
  const maxSizeRaw = cfg.maxSizeRaw;
  const limitMb = originalSizeMb(item.sizeBytes);
  let hint: { kind: HintKind; text: string } | null = null;
  const parsed = parseMaxMb(maxSizeRaw);
  if (!compressible) {
    hint = {
      kind: 'warning',
      text: target
        ? `O formato ${label} é sem perdas: ele não reduz o tamanho sob demanda mantendo o formato original.`
        : 'Não é possível comprimir este arquivo mantendo o formato original.',
    };
  } else if (parsed === null) {
    hint =
      maxSizeRaw.trim() === ''
        ? { kind: 'info', text: 'Defina um tamanho máximo (em MB) para este arquivo.' }
        : { kind: 'error', text: 'Informe um tamanho máximo maior que zero (em MB).' };
  } else if (limitMb !== null && parsed > limitMb) {
    hint = {
      kind: 'error',
      text: `O tamanho máximo não pode ser maior que o tamanho original do arquivo (${formatMb(limitMb)}).`,
    };
  } else {
    hint = compressionHint(cfg.estimate, label ?? '', item.sizeBytes, parsed);
  }
  return { label, sizeText, compressible, maxSizeRaw, hint, limitMb };
});

function onTarget(event: Event): void {
  emit('updateMax', props.item.id, (event.target as HTMLInputElement).value);
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
}

function hintClass(kind: HintKind): string {
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
              :value="view.maxSizeRaw"
              type="text"
              :min="0.01"
              :step="0.1"
              :max="view.limitMb ?? undefined"
              inputmode="decimal"
              class="w-24 rounded-md border border-edge bg-surface-raised px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-accent focus:border-accent"
              @input="onTarget"
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