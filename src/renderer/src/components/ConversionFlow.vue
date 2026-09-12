<script setup lang="ts">
import DropZone from './DropZone.vue';
import DraftList from './DraftList.vue';
import { useConversionStore, type BannerMessage } from '../flows/useConversionStore';
import type { MediaCategory } from '@shared/types';
import { userMessage } from '@shared/errors';

const emit = defineEmits<{
  banner: [message: BannerMessage];
  submitStart: [];
  completion: [compressed: boolean];
}>();

const store = useConversionStore();
const { drafts, converting, formatsByCategory, removeAllDrafts, removeDraft, setCategoryFormat } =
  store;

async function onAdded(paths: string[]): Promise<void> {
  const message = await store.addFiles(paths);
  if (message) emit('banner', message);
}

async function onConvert(category: MediaCategory): Promise<void> {
  const result = await store.submitCategory(category, () => emit('submitStart'));
  if (result === null) return;
  if (result.ok) {
    emit('completion', false);
  } else {
    emit('banner', { kind: 'error', text: userMessage(result.error) });
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-dim">Conversão</h2>

    <DropZone @added="onAdded" />

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
      <DraftList
        :items="drafts"
        :formats="formatsByCategory"
        :converting="converting"
        @remove="removeDraft"
        @set-format="setCategoryFormat"
        @convert="onConvert"
      />
    </div>
    <p v-else class="text-center text-xs text-ink-dim">Nenhum arquivo adicionado ainda.</p>
  </section>
</template>