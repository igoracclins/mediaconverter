import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveFfmpegBinaries } from '../paths';

describe('resolveFfmpegBinaries', () => {
  it('points at the platform layout', () => {
    const resolved = resolveFfmpegBinaries('/base', 'darwin', 'arm64');
    expect(resolved.ffmpeg).toBe('/base/ffmpeg/darwin-arm64/ffmpeg');
    expect(resolved.ffprobe).toBe('/base/ffmpeg/darwin-arm64/ffprobe');
    expect(resolved.present).toBe(false);
  });

  it('uses .exe on Windows', () => {
    const resolved = resolveFfmpegBinaries('/base', 'win32', 'x64');
    expect(resolved.ffmpeg).toBe('/base/ffmpeg/win32-x64/ffmpeg.exe');
    expect(resolved.ffprobe).toBe('/base/ffmpeg/win32-x64/ffprobe.exe');
  });

  it('reports presence when both files exist', () => {
    const resolved = resolveFfmpegBinaries('resources', 'darwin', 'arm64');
    if (existsSync(resolved.ffmpeg) && existsSync(resolved.ffprobe)) {
      expect(resolved.present).toBe(true);
    }
  });
});
