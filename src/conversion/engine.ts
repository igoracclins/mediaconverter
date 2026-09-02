import type {
  AppErrorCode,
  ConversionEngineId,
  MediaCategory,
  QualityPreset,
  TargetFormat,
} from '@shared/types';
import type { CompressionEncode } from './compress';

export interface ConversionTask {
  id: string;
  inputPath: string;
  outputPath: string;
  sourceExtension: string;
  category: MediaCategory;
  targetFormat: TargetFormat;
  quality: QualityPreset;
  durationMs: number | null;
  compression?: {
    maxSizeMb: number;
    encode: CompressionEncode;
  };
}

export interface EngineRunResult {
  ok: boolean;
  errorCode: AppErrorCode | null;
  errorMessage: string | null;
}

export type ProgressReporter = (progress: number | null) => void;

export interface EngineHandle {
  readonly finished: Promise<EngineRunResult>;
  cancel(): void;
}

export interface ConversionEngine {
  readonly id: ConversionEngineId;
  convert(task: ConversionTask, onProgress: ProgressReporter): EngineHandle;
}

export interface EngineBundle {
  ffmpeg: ConversionEngine;
  sharp: ConversionEngine;
}

export function engineFor(
  category: MediaCategory,
  bundle: EngineBundle,
): ConversionEngine | undefined {
  if (category === 'image') return bundle.sharp;
  if (category === 'video') return bundle.ffmpeg;
  if (category === 'audio') return bundle.ffmpeg;
  return undefined;
}
