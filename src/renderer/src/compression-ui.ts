import { bytesToMb, parseTargetSizeMb } from '@conversion/compress';
import type { CompressionEstimate } from '@shared/ipc';
import type { MediaCategory } from '@shared/types';

export function formatMb(mb: number): string {
  return `${Math.round(mb * 100) / 100} MB`;
}

export function parseMaxMb(raw: string): number | null {
  return parseTargetSizeMb(raw);
}

export function originalSizeMb(sizeBytes: number): number | null {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return null;
  return bytesToMb(sizeBytes);
}

export interface InitialSizeInput {
  sizeBytes: number;
  recommendedMinMb: number | null;
  hardMinMb: number | null;
  category: MediaCategory;
}

const SEED_MARGIN_MB = 100;

export const CATEGORY_MIN_SEED_MB: Record<MediaCategory, number> = {
  audio: 3,
  video: 15,
  image: 0,
};

export function initialSizeMb(input: InitialSizeInput): number | null {
  const limitMb = originalSizeMb(input.sizeBytes);
  if (limitMb === null) return null;
  const recommended = input.recommendedMinMb ?? input.hardMinMb;
  if (recommended === null || recommended <= 0) return null;
  const candidate = recommended + SEED_MARGIN_MB;
  const hardMin = input.hardMinMb ?? 0;
  const qualityFloor =
    input.category === 'image'
      ? Math.min(hardMin, limitMb)
      : Math.max(hardMin, CATEGORY_MIN_SEED_MB[input.category]);
  const seed = Math.min(Math.max(Math.min(candidate, limitMb), qualityFloor), limitMb);
  const rounded = Math.floor(seed * 100) / 100;
  return rounded > 0 ? rounded : limitMb;
}

export function maxSizeWithinLimit(raw: string, sizeBytes: number): boolean {
  const parsed = parseMaxMb(raw);
  if (parsed === null) return false;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return true;
  return parsed <= originalSizeMb(sizeBytes)!;
}

export type HintKind = 'info' | 'warning' | 'error';

export interface CompressionHint {
  kind: HintKind;
  text: string;
}

export function compressionHint(
  estimate: CompressionEstimate | null,
  formatLabel: string,
  sizeBytes: number,
  maxMb: number | null,
): CompressionHint | null {
  if (!estimate) return null;
  if (estimate.status === 'unsupported') {
    if (estimate.unsupportedReason === 'lossless-target') {
      return {
        kind: 'warning',
        text: `O formato ${formatLabel} é sem perdas: ele não reduz o tamanho sob demanda. Para comprimir, escolha um formato com compressão (ex.: MP3, M4A, MP4, WEBM, JPG, AVIF).`,
      };
    }
    return {
      kind: 'warning',
      text: 'Não foi possível estimar o tamanho recomendado para este arquivo (duração desconhecida).',
    };
  }
  const limitMb = originalSizeMb(sizeBytes);
  const displayedFileMb = limitMb === null ? null : Math.round(limitMb * 100) / 100;
  if (maxMb !== null && displayedFileMb !== null) {
    if (maxMb >= displayedFileMb) {
      return {
        kind: 'info',
        text: 'O limite não exige redução do tamanho original do arquivo.',
      };
    }
    if (displayedFileMb - maxMb <= displayedFileMb * 0.05) {
      return null;
    }
  }
  if (estimate.status === 'impossible') {
    const hardMin = Math.min(estimate.hardMinMb ?? 0, limitMb ?? Infinity);
    return {
      kind: 'error',
      text: `Esse limite é muito baixo para manter uma qualidade aceitável. Tamanho mínimo recomendado: aproximadamente ${formatMb(hardMin)}.`,
    };
  }
  if (estimate.status === 'aggressive') {
    const recMin = Math.min(estimate.recommendedMinMb ?? 0, limitMb ?? Infinity);
    return {
      kind: 'warning',
      text: `Este limite exige compressão agressiva e pode causar perda significativa de qualidade. Tamanho recomendado para melhor qualidade: aproximadamente ${formatMb(recMin)}.`,
    };
  }
  return { kind: 'info', text: 'Configuração possível dentro do limite.' };
}
