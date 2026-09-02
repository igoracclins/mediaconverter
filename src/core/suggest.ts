import type { MediaCategory, TargetFormat } from '@shared/types';

const DEFAULT_SUGGESTION: Record<MediaCategory, TargetFormat> = {
  audio: 'mp3',
  video: 'mp4',
  image: 'webp',
};

export function suggestTarget(category: MediaCategory): TargetFormat {
  return DEFAULT_SUGGESTION[category];
}

const IMAGE_PREFERENCE: Record<string, TargetFormat> = {
  avif: 'jpg',
  jxl: 'jpg',
  tif: 'jpg',
  tiff: 'jpg',
  bmp: 'png',
};

export function suggestImageTarget(sourceExtension: string): TargetFormat {
  return IMAGE_PREFERENCE[sourceExtension.toLowerCase()] ?? 'webp';
}
