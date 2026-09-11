<script setup lang="ts">
import type { JobSnapshot } from '@shared/ipc';

const props = defineProps<{ jobs: JobSnapshot[]; messageFor: (job: JobSnapshot) => string }>();
const emit = defineEmits<{ cancel: [jobId: string] }>();

const statusStyles: Record<string, string> = {
  pending: 'bg-surface-raised text-ink-dim',
  processing: 'bg-accent/15 text-accent',
  completed: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-rose-500/15 text-rose-300',
  cancelled: 'bg-surface-raised text-ink-dim',
};

function label(job: JobSnapshot): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    processing: job.compression ? 'Comprimindo…' : 'Convertendo…',
    completed: 'Concluído',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  };
  return labels[job.status] ?? job.status;
}
</script>

<template>
  <section v-if="props.jobs.length > 0">
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-dim">Fila</h2>
    <ul class="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface-alt">
      <li v-for="job in props.jobs" :key="job.id" class="flex items-center gap-3 px-4 py-2.5">
        <span class="min-w-0 flex-1">
          <p class="truncate text-sm text-ink" :title="job.outputPath ?? job.name">
            {{ job.name }}
          </p>
          <p
            v-if="job.status === 'failed' && props.messageFor(job)"
            class="mt-0.5 truncate text-xs text-danger"
          >
            {{ props.messageFor(job) }}
          </p>
        </span>

        <div v-if="job.status === 'pending' || job.status === 'processing'" class="w-40 shrink-0">
          <span class="mb-1 block h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <span
              class="block h-full rounded-full bg-accent transition-all duration-300"
              :style="{
                width: `${job.progress ?? (job.status === 'processing' ? 8 : 0)}%`,
              }"
            />
          </span>
        </div>

        <span
          class="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
          :class="statusStyles[job.status] ?? 'bg-surface-raised text-ink-dim'"
        >
          {{ label(job) }}
        </span>

        <span class="hidden shrink-0 text-[11px] text-ink-dim md:inline">{{
          job.targetFormat
        }}</span>

        <button
          v-if="job.status === 'pending' || job.status === 'processing'"
          type="button"
          class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm text-ink-dim transition-colors hover:bg-surface-raised hover:text-danger"
          title="Cancelar"
          @click="emit('cancel', job.id)"
        >
          ✕
        </button>
      </li>
    </ul>
  </section>
</template>
