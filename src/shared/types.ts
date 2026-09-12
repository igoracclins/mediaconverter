export type MediaCategory = 'audio' | 'video' | 'image';

export type AudioTargetFormat = 'mp3' | 'wav' | 'm4a' | 'ogg' | 'flac';
export type VideoTargetFormat = 'mp4' | 'mov' | 'mkv' | 'webm';
export type ImageTargetFormat = 'jpg' | 'png' | 'webp' | 'avif';

export type TargetFormat = AudioTargetFormat | VideoTargetFormat | ImageTargetFormat;

export type QualityPreset = 'high' | 'medium' | 'low';

export type Operation = 'convert' | 'compress' | 'extract';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type ConversionEngineId = 'ffmpeg' | 'sharp';

export type AppErrorCode =
  | 'FFMPEG_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'INVALID_PATH'
  | 'UNSUPPORTED_SOURCE'
  | 'MISSING_FILE'
  | 'OUTPUT_EXISTS'
  | 'NO_WRITE_PERMISSION'
  | 'OUTPUT_NOT_CREATED'
  | 'NO_AUDIO_STREAM'
  | 'ENCODE_FAILED'
  | 'JOB_CANCELLED'
  | 'ENGINE_UNAVAILABLE'
  | 'INTERNAL';

export const AUDIO_TARGET_FORMATS: readonly AudioTargetFormat[] = [
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'flac',
];
export const VIDEO_TARGET_FORMATS: readonly VideoTargetFormat[] = ['mp4', 'mov', 'mkv', 'webm'];
export const IMAGE_TARGET_FORMATS: readonly ImageTargetFormat[] = ['jpg', 'png', 'webp', 'avif'];
export const ALL_TARGET_FORMATS: readonly TargetFormat[] = [
  ...AUDIO_TARGET_FORMATS,
  ...VIDEO_TARGET_FORMATS,
  ...IMAGE_TARGET_FORMATS,
];

export const QUALITY_PRESETS: readonly QualityPreset[] = ['high', 'medium', 'low'];
