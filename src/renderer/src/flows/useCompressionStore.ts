import { ref } from 'vue';
import type { ConversionRequestItem, StartConversionResult } from '@shared/ipc';
import type { MediaCategory, QualityPreset } from '@shared/types';
import { userMessage } from '@shared/errors';
import type { CompressDraft, CompressionDraftConfig } from '../types';
import { compressTargetFor, maxSizeValidation } from '../compression-ui';

export type BannerMessage = { kind: 'error' | 'info'; text: string };

function newCompressionConfig(): CompressionDraftConfig {
  return { maxSizeRaw: '' };
}

export function useCompressionStore() {
  const operation = 'compress' as const;
  const drafts = ref<CompressDraft[]>([]);
  const converting = ref(false);

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
        const validation = maxSizeValidation(cfg.maxSizeRaw, draft.sizeBytes);
        if (!validation.ok || validation.maxMb === null) continue;
        items.push({
          inputPath: draft.path,
          targetFormat: target.format,
          quality: 'high' as QualityPreset,
          compression: { maxSizeMb: validation.maxMb },
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