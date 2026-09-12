import { ref } from 'vue';
import type { ConversionRequestItem, StartConversionResult } from '@shared/ipc';
import type { AudioTargetFormat, QualityPreset } from '@shared/types';
import { userMessage } from '@shared/errors';
import type { ExtractDraft } from '../types';

export type BannerMessage = { kind: 'error' | 'info'; text: string };

const NON_VIDEO_SINGLE =
  'Este arquivo não é um vídeo e foi ignorado. A extração de áudio aceita somente vídeos.';
const NON_VIDEO_MULTI = (count: number): string =>
  `${count} arquivos não são vídeos e foram ignorados. A extração de áudio aceita somente vídeos.`;

export function useExtractionStore() {
  const operation = 'extract' as const;
  const drafts = ref<ExtractDraft[]>([]);
  const converting = ref(false);
  const targetFormat = ref<AudioTargetFormat>('mp3');

  async function addFiles(paths: string[]): Promise<BannerMessage | null> {
    const result = await window.api.inspectFiles(paths);
    const seen = new Set(drafts.value.map((d) => d.path));
    let skippedNonVideo = 0;
    for (const file of result.files) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      if (file.category !== 'video') {
        skippedNonVideo++;
        continue;
      }
      drafts.value.push({ ...file, id: file.path });
    }
    if (result.rejected.length > 0) {
      return result.rejected.length === 1
        ? { kind: 'error' as const, text: userMessage(result.rejected[0]?.reason ?? 'UNSUPPORTED_SOURCE') }
        : { kind: 'error' as const, text: `${result.rejected.length} arquivos não foram suportados.` };
    }
    if (skippedNonVideo > 0) {
      return skippedNonVideo === 1
        ? { kind: 'info' as const, text: NON_VIDEO_SINGLE }
        : { kind: 'info' as const, text: NON_VIDEO_MULTI(skippedNonVideo) };
    }
    return null;
  }

  function removeDraft(id: string): void {
    drafts.value = drafts.value.filter((d) => d.id !== id);
  }

  function removeAllDrafts(): void {
    drafts.value = [];
  }

  function setTargetFormat(format: AudioTargetFormat): void {
    targetFormat.value = format;
  }

  async function submit(onBeforeSubmit?: () => void): Promise<StartConversionResult | null> {
    if (converting.value || drafts.value.length === 0) return null;
    converting.value = true;
    try {
      const items: ConversionRequestItem[] = drafts.value.map((d) => ({
        inputPath: d.path,
        targetFormat: targetFormat.value,
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
    targetFormat,
    addFiles,
    removeDraft,
    removeAllDrafts,
    setTargetFormat,
    submit,
  };
}