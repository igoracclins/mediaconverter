import { parseTargetSizeMb } from '@conversion/compress';
import type { CompressionEstimate } from '@shared/ipc';

export function formatMb(mb: number): string {
  return `${Math.round(mb * 10) / 10} MB`;
}

export function parseMaxMb(raw: string): number | null {
  return parseTargetSizeMb(raw);
}

export type HintKind = 'info' | 'warning' | 'error';

export interface CompressionHint {
  kind: HintKind;
  text: string;
}

export function compressionHint(
  estimate: CompressionEstimate | null,
  formatLabel: string,
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
  if (estimate.status === 'impossible') {
    return {
      kind: 'error',
      text: `Esse limite é muito baixo para manter uma qualidade aceitável. Tamanho mínimo recomendado: aproximadamente ${formatMb(estimate.hardMinMb ?? 0)}.`,
    };
  }
  if (estimate.status === 'aggressive') {
    return {
      kind: 'warning',
      text: `Este limite exige compressão agressiva e pode causar perda significativa de qualidade. Tamanho recomendado para melhor qualidade: aproximadamente ${formatMb(estimate.recommendedMinMb ?? 0)}.`,
    };
  }
  return { kind: 'info', text: 'Configuração possível dentro do limite.' };
}
