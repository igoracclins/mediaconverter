import type { MediaCategory, TargetFormat } from '@shared/types';

const AUDIO_KEEP: Record<string, TargetFormat> = {
  mp3: 'mp3',
  m4a: 'm4a',
  m4b: 'm4a',
  m4r: 'm4a',
  aac: 'm4a',
  mp2: 'm4a',
  ogg: 'ogg',
  oga: 'ogg',
  opus: 'ogg',
  wav: 'wav',
  wave: 'wav',
  flac: 'flac',
};

const VIDEO_KEEP: Record<string, TargetFormat> = {
  mp4: 'mp4',
  m4v: 'mp4',
  hevc: 'mp4',
  h264: 'mp4',
  '3gp': 'mp4',
  '3gpp': 'mp4',
  mov: 'mov',
  mkv: 'mkv',
  webm: 'webm',
};

const IMAGE_KEEP: Record<string, TargetFormat> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
  png: 'png',
};

const LOSSLESS: ReadonlySet<TargetFormat> = new Set<TargetFormat>(['wav', 'flac', 'png']);

export function keepFormatFor(category: MediaCategory, extension: string): TargetFormat | null {
  const ext = extension.toLowerCase().replace(/^\./, '');
  switch (category) {
    case 'audio':
      return AUDIO_KEEP[ext] ?? null;
    case 'video':
      return VIDEO_KEEP[ext] ?? null;
    case 'image':
      return IMAGE_KEEP[ext] ?? null;
  }
}

export function isLosslessFormat(format: TargetFormat): boolean {
  return LOSSLESS.has(format);
}
