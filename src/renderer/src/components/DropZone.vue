<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{ added: [paths: string[]] }>();
const dragging = ref(false);

async function resolveDropped(event: DragEvent): Promise<string[]> {
  const paths: string[] = [];
  for (const item of event.dataTransfer?.items ?? []) {
    const file = item.kind === 'file' ? item.getAsFile() : null;
    if (file) {
      const resolved = window.api.getPathForFile(file);
      if (resolved) paths.push(resolved);
    }
  }
  return paths;
}

function onDrop(event: DragEvent): void {
  dragging.value = false;
  void resolveDropped(event).then((paths) => {
    if (paths.length > 0) emit('added', paths);
  });
}

function pickFiles(): void {
  void window.api.openFiles().then((result) => {
    if (!result.cancelled && result.files.length > 0) {
      emit(
        'added',
        result.files.map((f) => f.path),
      );
    }
  });
}
</script>

<template>
  <button
    type="button"
    class="group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-edge bg-surface-alt px-6 py-10 text-center transition-colors hover:border-accent"
    :class="dragging ? 'border-accent bg-surface-raised' : ''"
    @click="pickFiles"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <span class="text-4xl leading-none text-ink-dim">⬆</span>
    <span class="text-sm font-medium text-ink"
      >Arraste arquivos de mídia aqui ou clique para procurar</span
    >
    <span class="text-xs text-ink-dim"
      >Áudio, vídeo e imagens de qualquer tamanho — convertido localmente, nada sai do seu
      dispositivo.</span
    >
  </button>
</template>
