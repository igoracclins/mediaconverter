import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { AppInfo, JobSnapshot, QueueSnapshot } from '@shared/ipc';
import { userMessage } from '@shared/errors';

export function useQueue() {
  const appInfo = ref<AppInfo | null>(null);
  const snapshot = ref<QueueSnapshot | null>(null);
  let unsub: (() => void) | null = null;

  const jobs = computed<JobSnapshot[]>(() => snapshot.value?.jobs ?? []);
  const activeCount = computed(() => snapshot.value?.activeCount ?? 0);
  const hasPending = computed(() =>
    jobs.value.some((job) => job.status === 'pending' || job.status === 'processing'),
  );

  async function refreshAppInfo(): Promise<void> {
    appInfo.value = await window.api.getAppInfo();
  }

  function messageFor(job: JobSnapshot): string {
    if (job.errorMessage && job.errorMessage !== 'Conversão cancelada.') {
      return job.errorMessage;
    }
    if (job.errorCode) return userMessage(job.errorCode);
    return '';
  }

  onMounted(() => {
    void refreshAppInfo();
    unsub = window.api.onQueueUpdated((next) => {
      snapshot.value = next;
    });
  });

  onUnmounted(() => {
    unsub?.();
  });

  return {
    appInfo,
    snapshot,
    jobs,
    activeCount,
    hasPending,
    messageFor,
    refreshAppInfo,
  };
}
