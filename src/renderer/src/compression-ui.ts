import { bytesToMb, MB_BYTES } from '@conversion/compress';
import { TARGET_FORMAT_MAP } from '@shared/formats';
import type { MediaCategory, TargetFormat } from '@shared/types';
import { keepFormatFor, isLosslessFormat } from './compression-format';
import type { CompressionDraftConfig } from './types';

export function formatMb(mb: number): string {
  return `${(Math.round(mb * 100) / 100).toFixed(2)} MB`;
}

export function originalSizeMb(sizeBytes: number): number | null {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return null;
  return bytesToMb(sizeBytes);
}

export function sanitizeSizeInput(raw: string): string {
  let out = '';
  let separator: '.' | ',' | null = null;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if ((ch === '.' || ch === ',') && separator === null) {
      separator = ch;
      out += ch;
    }
  }
  return out;
}

export function parseMaxInput(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '' || cleaned === '.') return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function minimumAllowedMb(sizeBytes: number): number {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 0.1;
  return Math.max((sizeBytes * 0.05) / MB_BYTES, 0.1);
}

export type MaxSizeIssue = 'empty' | 'not-number' | 'not-below-original' | 'below-minimum';

export interface MaxSizeValidation {
  ok: boolean;
  maxMb: number | null;
  issue: MaxSizeIssue | null;
}

export function maxSizeValidation(raw: string, sizeBytes: number): MaxSizeValidation {
  const value = parseMaxInput(raw);
  if (value === null) {
    return { ok: false, maxMb: null, issue: raw.trim() === '' ? 'empty' : 'not-number' };
  }
  if (value <= 0) {
    return { ok: false, maxMb: value, issue: 'empty' };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: true, maxMb: value, issue: null };
  }
  if (value * MB_BYTES >= sizeBytes) {
    return { ok: false, maxMb: value, issue: 'not-below-original' };
  }
  if (value < minimumAllowedMb(sizeBytes)) {
    return { ok: false, maxMb: value, issue: 'below-minimum' };
  }
  return { ok: true, maxMb: value, issue: null };
}

export interface CompressTarget {
  format: TargetFormat;
  label: string;
  lossless: boolean;
}

export function compressTargetFor(category: MediaCategory, extension: string): CompressTarget | null {
  const format = keepFormatFor(category, extension);
  if (!format) return null;
  return {
    format,
    label: TARGET_FORMAT_MAP[format].label,
    lossless: isLosslessFormat(format),
  };
}

export function isCompressionReady(
  category: MediaCategory,
  extension: string,
  cfg: CompressionDraftConfig | null,
  sizeBytes: number,
): boolean {
  const target = compressTargetFor(category, extension);
  if (!target || target.lossless) return false;
  const validation = maxSizeValidation(cfg?.maxSizeRaw ?? '', sizeBytes);
  return validation.ok && validation.maxMb !== null && validation.maxMb > 0;
}