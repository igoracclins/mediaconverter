import { onBeforeUnmount, ref } from 'vue';
import type { ConversionRequestItem, StartConversionResult } from '@shared/ipc';
import type { MediaCategory, QualityPreset } from '@shared/types';
import { userMessage } from '@shared/errors';
import { parseTargetSizeMb } from '@conversion/compress';
import type { CompressDraft, CompressionDraftConfig } from '../types';
import { compressTargetFor, initialSizeMb, maxSizeWithinLimit } from '../compression-ui';

export type BannerMessage = { kind: 'error' | 'info'; text: string };

function newCompressionConfig(): CompressionDraftConfig {
  return {
    maxSizeRaw: '',
    estimate: null,
    estimating: false,
    lastSyncKey: null,
  };
}

export function useCompressionStore() {
  const operation = 'compress' as const;
  const drafts = ref<CompressDraft[]>([]);
  const converting = ref(false);
  let estimateTimer: ReturnType<typeof setTimeout> | null = null;

  async function addFiles(paths: string[]): Promise<BannerMessage | null> {
    const result = await window.api.inspectFiles(paths);
    const seen = new Set(drafts.value.map((d) => d.path));
    let added = 0;
    for (const file of result.files) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      drafts.value.push({ ...file, id: file.path, compression: newCompressionConfig() });
      added++;
    }
    if (added > 0) scheduleEstimateSync();
    if (result.rejected.length > 0) {
      return result.rejected.length === 1
        ? { kind: 'error' as const, text: userMessage(result.rejected[0]?.reason ?? 'UNSUPPORTED_SOURCE') }
        : { kind: 'error' as const, text: `${result.rejected.length} arquivos não foram suportados.` };
    }
    return null;
  }

  function removeDraft(id: string): void {
    drafts.value = drafts.value.filter((d) => d.id !== id);
  }

  function removeAllDrafts(): void {
    drafts.value = [];
  }

  function updateConfig(
    id: string,
    patch: Partial<Pick<CompressionDraftConfig, 'maxSizeRaw'>>,
  ): void {
    const draft = drafts.value.find((d) => d.id === id);
    if (!draft) return;
    Object.assign(draft.compression, patch);
    scheduleEstimateSync();
  }

  function scheduleEstimateSync(): void {
    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => {
      void syncEstimates();
    }, 350);
  }

  async function syncEstimates(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      let changed = false;
      for (const draft of drafts.value) {
        const cfg = draft.compression;
        const target = compressTargetFor(draft.category, draft.extension);
        if (!target || target.lossless) continue;
        const key = `${cfg.maxSizeRaw}`;
        if (cfg.estimating || cfg.lastSyncKey === key) continue;
        const maxMb = parseTargetSizeMb(cfg.maxSizeRaw);
        const probe = maxMb ?? 1;
        cfg.estimating = true;
        changed = true;
        try {
          const result = await window.api.estimateCompression({
            inputPath: draft.path,
            targetFormat: target.format,
            maxSizeMb: probe,
          });
          let seeded = false;
          if (result.ok) {
            if (maxMb === null && cfg.maxSizeRaw.trim() === '') {
              const seededMb = initialSizeMb({
                sizeBytes: draft.sizeBytes,
                recommendedMinMb: result.estimate.recommendedMinMb,
                hardMinMb: result.estimate.hardMinMb,
                category: draft.category,
              });
              if (seededMb !== null) {
                cfg.maxSizeRaw = String(seededMb);
                seeded = true;
              }
            }
            cfg.estimate = seeded ? null : result.estimate;
          } else {
            cfg.estimate = null;
          }
        } finally {
          cfg.estimating = false;
          cfg.lastSyncKey = key;
        }
      }
      if (!changed) break;
    }
  }

  async function submitCategory(
    category: MediaCategory,
    onBeforeSubmit?: () => void,
  ): Promise<StartConversionResult | null> {
    if (converting.value) return null;
    const categoryDrafts = drafts.value.filter((d) => d.category === category);
    if (categoryDrafts.length === 0) return null;

    converting.value = true;
    try {
      const items: ConversionRequestItem[] = [];
      for (const draft of categoryDrafts) {
        const cfg = draft.compression;
        const target = compressTargetFor(draft.category, draft.extension);
        if (!target || target.lossless) continue;
        const maxSizeMb = parseTargetSizeMb(cfg.maxSizeRaw);
        if (maxSizeMb === null) continue;
        if (!maxSizeWithinLimit(cfg.maxSizeRaw, draft.sizeBytes)) continue;
        items.push({
          inputPath: draft.path,
          targetFormat: target.format,
          quality: 'high' as QualityPreset,
          compression: { maxSizeMb },
        });
      }
      const submitted = new Set(items.map((item) => item.inputPath));
      onBeforeSubmit?.();
      const result: StartConversionResult =
        items.length > 0
          ? await window.api.startConversion({
              operation,
              items,
              destination: null,
            })
          : { ok: true as const, created: 0, rejected: [] };
      if (result.ok) {
        drafts.value = drafts.value.filter((d) => !submitted.has(d.path));
      }
      return result;
    } finally {
      converting.value = false;
    }
  }

  onBeforeUnmount(() => {
    if (estimateTimer) clearTimeout(estimateTimer);
  });

  return {
    operation,
    drafts,
    converting,
    addFiles,
    removeDraft,
    removeAllDrafts,
    updateConfig,
    submitCategory,
  };
}