import { ref } from 'vue';
import type { StartConversionResult } from '@shared/ipc';
import type { MediaCategory, QualityPreset, TargetFormat } from '@shared/types';
import { userMessage } from '@shared/errors';
import type { ConvertDraft } from '../types';

export type BannerMessage = { kind: 'error' | 'info'; text: string };

export function useConversionStore() {
  const operation = 'convert' as const;
  const drafts = ref<ConvertDraft[]>([]);
  const converting = ref(false);
  const formatsByCategory = ref<Record<MediaCategory, TargetFormat>>({
    video: 'mp4',
    audio: 'mp3',
    image: 'jpg',
  });

  async function addFiles(paths: string[]): Promise<BannerMessage | null> {
    const result = await window.api.inspectFiles(paths);
    const seen = new Set(drafts.value.map((d) => d.path));
    let added = 0;
    for (const file of result.files) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      drafts.value.push({ ...file, id: file.path });
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

  function setCategoryFormat(category: MediaCategory, format: TargetFormat): void {
    formatsByCategory.value[category] = format;
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
      const format = formatsByCategory.value[category];
      const items = categoryDrafts.map((d) => ({
        inputPath: d.path,
        targetFormat: format,
        quality: 'high' as QualityPreset,
      }));
      const submitted = new Set(items.map((item) => item.inputPath));
      onBeforeSubmit?.();
      const result = await window.api.startConversion({
        operation,
        items,
        destination: null,
      });
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
    formatsByCategory,
    addFiles,
    removeDraft,
    removeAllDrafts,
    setCategoryFormat,
    submitCategory,
  };
}