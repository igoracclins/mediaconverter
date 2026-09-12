<script setup lang="ts">
import type { Operation } from '@shared/types';
import { userMessage } from '@shared/errors';
import DropZone from './DropZone.vue';
import ExtractionDraftList from './ExtractionDraftList.vue';
import { useExtractionStore, type BannerMessage } from '../flows/useExtractionStore';

const emit = defineEmits<{
  banner: [message: BannerMessage];
  submitStart: [];
  completion: [operation: Operation];
}>();

const store = useExtractionStore();
const { drafts, converting, targetFormat, removeAllDrafts, removeDraft, setTargetFormat } = store;

async function onAdded(paths: string[]): Promise<void> {
  const message = await store.addFiles(paths);
  if (message) emit('banner', message);
}

async function onExtract(): Promise<void> {
  const result = await store.submit(() => emit('submitStart'));
  if (result === null) return;
  if (result.ok) {
    emit('completion', 'extract');
  } else {
    emit('banner', { kind: 'error', text: userMessage(result.error) });
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">Extração de áudio</h2>

    <DropZone
      hint="Vídeos de qualquer tamanho. Apenas a faixa de áudio será extraída, sempre na pasta Extraidos, nada sai do seu dispositivo."
      @added="onAdded"
    />

    <div v-if="drafts.length > 0" class="flex flex-col gap-4">
      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
          @click="removeAllDrafts()"
        >
          Remover todos
        </button>
      </div>
      <ExtractionDraftList
        :items="drafts"
        :target-format="targetFormat"
        :converting="converting"
        @remove="removeDraft"
        @set-format="setTargetFormat"
        @extract="onExtract"
      />
    </div>
    <p v-else class="text-center text-xs text-ink-dim">Nenhum arquivo adicionado ainda.</p>
  </section>
</template>