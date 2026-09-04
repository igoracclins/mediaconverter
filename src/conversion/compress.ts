import type {
  CompressionEstimate,
  CompressionEstimateStatus,
  CompressionUnsupportedReason,
} from '@shared/ipc';
import type { MediaCategory, TargetFormat, VideoTargetFormat } from '@shared/types';

export const MB_BITS = 8 * 1024 * 1024;
export const MB_BYTES = 1024 * 1024;

export function mbToBits(mb: number): number {
  return mb * MB_BITS;
}

export function bitsToMb(bits: number): number {
  return bits / MB_BITS;
}

export function bitsToKbps(bps: number): number {
  return Math.max(1, Math.round(bps / 1000));
}

export function bytesToMb(bytes: number): number {
  return bytes / MB_BYTES;
}

export function parseTargetSizeMb(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

export function isValidCompressionOptions(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return parseTargetSizeMb(v.maxSizeMb) !== null && typeof v.maxSizeMb === 'number';
}

export type CompressionEncode =
  | { kind: 'audio'; audioBitrateBps: number }
  | { kind: 'audio-vorbis'; quality: number }
  | { kind: 'video-crf'; crf: number; audioBitrateBps: number }
  | { kind: 'video-abr'; videoBitrateBps: number; audioBitrateBps: number }
  | { kind: 'image'; quality: number }
  | { kind: 'lossless' }
  | { kind: 'none' };

const AUDIO_RECOMMENDED_BPS = 160_000;
const AUDIO_HARD_FLOOR_BPS = 64_000;
const MP3_MAX_BPS = 320_000;
const AAC_MAX_BPS = 256_000;

const VIDEO_RECOMMENDED_BPS = 1_200_000;
const VIDEO_HARD_FLOOR_BPS = 250_000;
const VIDEO_CEILING_BPS = 15_000_000;

const VIDEO_AUDIO_RESERVE_BPS: Record<VideoTargetFormat, number> = {
  mp4: 128_000,
  mov: 128_000,
  mkv: 128_000,
  webm: 96_000,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function classify(
  maxMb: number,
  recommendedMinMb: number,
  hardMinMb: number,
): CompressionEstimateStatus {
  if (maxMb < hardMinMb) return 'impossible';
  if (maxMb < recommendedMinMb) return 'aggressive';
  return 'ok';
}

function unsupportedEstimate(
  reason: CompressionUnsupportedReason,
  currentSizeMb: number,
): CompressionEstimate {
  return {
    status: 'unsupported',
    currentSizeMb,
    recommendedMinMb: null,
    hardMinMb: null,
    unsupportedReason: reason,
  };
}

function vorbisQualityForBps(bps: number): number {
  const t = clamp((bps - 45_000) / 275_000, 0, 1);
  return Math.round(2 + 8 * t);
}

export interface CompressionEvaluationInput {
  category: MediaCategory;
  targetFormat: TargetFormat;
  maxSizeMb: number;
  sizeBytes: number;
  durationMs: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface CompressionPlan {
  estimate: CompressionEstimate;
  encode: CompressionEncode;
}

export interface RefineInput {
  category: MediaCategory;
  targetFormat: TargetFormat;
  budgetMb: number;
  sizeBytes: number;
  durationMs: number | null;
  hasAudio: boolean;
}

function refineAudio(input: RefineInput): CompressionEncode {
  const { targetFormat, budgetMb, durationMs } = input;
  if (durationMs === null || durationMs <= 0) return { kind: 'none' };
  const durationSec = durationMs / 1000;
  const budgetBps = mbToBits(budgetMb) / durationSec;
  const maxBps = targetFormat === 'mp3' ? MP3_MAX_BPS : AAC_MAX_BPS;
  const encodeBps = clamp(Math.round(budgetBps), AUDIO_HARD_FLOOR_BPS, maxBps);
  return targetFormat === 'ogg'
    ? { kind: 'audio-vorbis', quality: vorbisQualityForBps(encodeBps) }
    : { kind: 'audio', audioBitrateBps: encodeBps };
}

function refineVideo(input: RefineInput): CompressionEncode {
  const { targetFormat, budgetMb, durationMs, hasAudio } = input;
  if (durationMs === null || durationMs <= 0) return { kind: 'none' };
  const durationSec = durationMs / 1000;
  const audioBps = hasAudio ? VIDEO_AUDIO_RESERVE_BPS[targetFormat as VideoTargetFormat] : 0;
  const videoBps = mbToBits(budgetMb) / durationSec - audioBps;
  const encodeBps = clamp(Math.round(videoBps), VIDEO_HARD_FLOOR_BPS, VIDEO_CEILING_BPS);
  return { kind: 'video-abr', videoBitrateBps: encodeBps, audioBitrateBps: audioBps };
}

function refineImage(input: RefineInput): CompressionEncode {
  const { budgetMb, sizeBytes } = input;
  const targetBytes = budgetMb * MB_BYTES;
  const ratio = Math.min(1, targetBytes / Math.max(1, sizeBytes));
  const quality = ratio >= 1 ? 95 : clamp(Math.round(100 * Math.pow(ratio, 0.55)), 25, 95);
  return { kind: 'image', quality };
}

export function encodeWithinBudget(input: RefineInput): CompressionEncode {
  switch (input.category) {
    case 'audio':
      return refineAudio(input);
    case 'video':
      return refineVideo(input);
    case 'image':
      return refineImage(input);
  }
}

function planAudio(input: CompressionEvaluationInput): CompressionPlan {
  const { targetFormat, maxSizeMb, durationMs, sizeBytes } = input;
  const currentSizeMb = bytesToMb(sizeBytes);

  if (targetFormat === 'wav' || targetFormat === 'flac') {
    return {
      estimate: unsupportedEstimate('lossless-target', currentSizeMb),
      encode: { kind: 'lossless' },
    };
  }
  if (durationMs === null || durationMs <= 0) {
    return {
      estimate: unsupportedEstimate('no-duration', currentSizeMb),
      encode: { kind: 'none' },
    };
  }

  const durationSec = durationMs / 1000;
  const recommendedMinMb = bitsToMb(AUDIO_RECOMMENDED_BPS * durationSec);
  const hardMinMb = bitsToMb(AUDIO_HARD_FLOOR_BPS * durationSec);
  const status = classify(maxSizeMb, recommendedMinMb, hardMinMb);

  return {
    estimate: { status, currentSizeMb, recommendedMinMb, hardMinMb },
    encode: encodeWithinBudget({ ...input, budgetMb: maxSizeMb }),
  };
}

function planVideo(input: CompressionEvaluationInput): CompressionPlan {
  const { targetFormat, maxSizeMb, durationMs, hasAudio, sizeBytes } = input;
  const currentSizeMb = bytesToMb(sizeBytes);

  if (durationMs === null || durationMs <= 0) {
    return {
      estimate: unsupportedEstimate('no-duration', currentSizeMb),
      encode: { kind: 'none' },
    };
  }

  const durationSec = durationMs / 1000;
  const audioBps = hasAudio ? VIDEO_AUDIO_RESERVE_BPS[targetFormat as VideoTargetFormat] : 0;
  const recommendedMinMb = bitsToMb((VIDEO_RECOMMENDED_BPS + audioBps) * durationSec);
  const hardMinMb = bitsToMb((VIDEO_HARD_FLOOR_BPS + audioBps) * durationSec);
  const status = classify(maxSizeMb, recommendedMinMb, hardMinMb);

  return {
    estimate: { status, currentSizeMb, recommendedMinMb, hardMinMb },
    encode: encodeWithinBudget({ ...input, budgetMb: maxSizeMb }),
  };
}

function planImage(input: CompressionEvaluationInput): CompressionPlan {
  const { targetFormat, maxSizeMb, sizeBytes } = input;
  const currentSizeMb = bytesToMb(sizeBytes);

  if (targetFormat === 'png') {
    return {
      estimate: unsupportedEstimate('lossless-target', currentSizeMb),
      encode: { kind: 'lossless' },
    };
  }

  const recommendedMinMb = currentSizeMb * 0.15;
  const hardMinMb = currentSizeMb * 0.08;
  const status = classify(maxSizeMb, recommendedMinMb, hardMinMb);

  return {
    estimate: { status, currentSizeMb, recommendedMinMb, hardMinMb },
    encode: encodeWithinBudget({ ...input, budgetMb: maxSizeMb }),
  };
}

export function evaluateCompression(input: CompressionEvaluationInput): CompressionPlan {
  switch (input.category) {
    case 'audio':
      return planAudio(input);
    case 'video':
      return planVideo(input);
    case 'image':
      return planImage(input);
  }
}
