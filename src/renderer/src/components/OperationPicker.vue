<script setup lang="ts">
import type { Operation } from '@shared/types';

const emit = defineEmits<{ select: [operation: Operation] }>();

const OPTIONS: { operation: Operation; title: string; description: string }[] = [
  {
    operation: 'convert',
    title: 'Conversão',
    description: 'Converter arquivos para outro formato, como MP4, MP3 ou JPG.',
  },
  {
    operation: 'compress',
    title: 'Compressão',
    description: 'Reduzir o tamanho de arquivos mantendo o formato original.',
  },
  {
    operation: 'extract',
    title: 'Extração de áudio',
    description: 'Extrair apenas a faixa de áudio de vídeos, como MP3, M4A ou WAV.',
  },
];
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">
      Escolha uma operação
    </h2>
    <p class="text-xs text-ink-dim">
      Primeiro escolha o que deseja fazer com seus arquivos. Você poderá adicioná-los na próxima
      etapa.
    </p>
    <div class="flex flex-col gap-3 sm:flex-row">
      <button
        v-for="option in OPTIONS"
        :key="option.operation"
        type="button"
        class="flex cursor-pointer flex-col items-start gap-1 rounded-xl border border-edge bg-surface-alt p-4 text-left transition-colors hover:border-accent hover:bg-surface-raised"
        @click="emit('select', option.operation)"
      >
        <span class="text-sm font-semibold text-ink">{{ option.title }}</span>
        <span class="text-xs text-ink-dim">{{ option.description }}</span>
      </button>
    </div>
  </section>
</template>