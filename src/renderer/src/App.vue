<script setup lang="ts">
import { ref, watch } from 'vue';
import OperationPicker from './components/OperationPicker.vue';
import ConversionFlow from './components/ConversionFlow.vue';
import CompressionFlow from './components/CompressionFlow.vue';
import QueueList from './components/QueueList.vue';
import { useQueue } from './composables/useQueue';
import type { Operation } from '@shared/types';

const { appInfo, jobs, messageFor } = useQueue();

const operation = ref<Operation | null>(null);
const banner = ref<{ kind: 'error' | 'info'; text: string } | null>(null);

const beforeIds = new Set<string>();
const batchIds = new Set<string>();
const completion = ref<{ hadIncompatible: boolean; compressed: boolean } | null>(null);

function hasTerminalJobs(): boolean {
  return jobs.value.some((job) => ['completed', 'failed', 'cancelled'].includes(job.status));
}

function clearCompleted(): void {
  void window.api.clearCompleted();
}

function cancelJob(jobId: string): void {
  void window.api.cancelJob(jobId);
}

function selectOperation(op: Operation): void {
  banner.value = null;
  operation.value = op;
}

function backToPicker(): void {
  banner.value = null;
  operation.value = null;
}

function onBanner(message: { kind: 'error' | 'info'; text: string }): void {
  banner.value = message;
}

function onSubmitStart(): void {
  for (const job of jobs.value) beforeIds.add(job.id);
}

function onCompletion(compressed: boolean): void {
  completion.value = { hadIncompatible: false, compressed };
}

watch(
  jobs,
  (list) => {
    for (const job of list) {
      if (
        job.status !== 'completed' &&
        job.status !== 'failed' &&
        job.status !== 'cancelled' &&
        !beforeIds.has(job.id)
      ) {
        batchIds.add(job.id);
      }
    }
    if (completion.value === null) return;
    const relevant = list.filter((job) => batchIds.has(job.id));
    if (relevant.length === 0) return;
    const hasActive = relevant.some(
      (job) => job.status === 'pending' || job.status === 'processing',
    );
    if (hasActive) return;
    const anyCompleted = relevant.some((job) => job.status === 'completed');
    const anyFailed = relevant.some((job) => job.status === 'failed' || job.status === 'cancelled');
    const { hadIncompatible, compressed } = completion.value;
    completion.value = null;
    beforeIds.clear();
    batchIds.clear();
    if (anyCompleted && !anyFailed && !hadIncompatible) {
      banner.value = {
        kind: 'info',
        text: compressed
          ? 'Arquivos comprimidos com sucesso. Os arquivos estão na pasta Comprimidos, junto aos arquivos originais.'
          : 'Arquivos convertidos com sucesso. Os arquivos estão na pasta Convertidos, junto aos arquivos originais.',
      };
    }
  },
  { deep: true },
);
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-4xl flex-col gap-4 p-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-ink">Media Converter</h1>
        <p v-if="appInfo" class="text-xs text-ink-dim">
          v{{ appInfo.appVersion }} {{ appInfo.platform }} {{ appInfo.arch }}
        </p>
      </div>
    </header>

    <div
      v-if="banner"
      class="rounded-lg border px-3 py-2 text-sm"
      :class="
        banner.kind === 'error'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          : 'border-edge bg-surface-raised text-ink-dim'
      "
    >
      {{ banner.text }}
    </div>

    <OperationPicker
      v-if="operation === null"
      @select="selectOperation"
    />

    <template v-else>
      <ConversionFlow
        v-if="operation === 'convert'"
        @back="backToPicker"
        @banner="onBanner"
        @submit-start="onSubmitStart"
        @completion="onCompletion"
      />
      <CompressionFlow
        v-else
        @back="backToPicker"
        @banner="onBanner"
        @submit-start="onSubmitStart"
        @completion="onCompletion"
      />
    </template>

    <QueueList
      v-if="jobs.length > 0"
      :jobs="jobs"
      :message-for="messageFor"
      @cancel="cancelJob"
    />

    <div v-if="hasTerminalJobs()" class="flex justify-end">
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
        @click="clearCompleted"
      >
        Limpar concluídos
      </button>
    </div>
  </div>
</template>