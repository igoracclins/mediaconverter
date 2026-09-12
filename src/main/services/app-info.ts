import { spawnSync } from 'node:child_process';
import { app } from 'electron';
import { resolveFfmpegBinaries } from '@platform/paths';
import { currentArch, currentPlatform } from '@platform/info';
import type { AppInfo } from '@shared/ipc';
import type { ConversionEngineId } from '@shared/types';
import { logger } from '../logger';

let cached: AppInfo | null = null;

export function getAppInfo(opts: { resourcesBaseDir: string }): AppInfo {
  if (cached) return cached;

  const platform = currentPlatform();
  const arch = currentArch();
  const binaries = resolveFfmpegBinaries(opts.resourcesBaseDir, platform, arch);
  const ffmpegPresent = binaries.present;

  let ffmpegVersion: string | null = null;
  if (ffmpegPresent) {
    const out = spawnSync(binaries.ffmpeg, ['-version'], { encoding: 'utf8', timeout: 15_000 });
    ffmpegVersion = out.status === 0 ? (out.stdout.split('\n')[0] ?? null) : null;
  }

  cached = {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? 'unknown',
    platform: platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux',
    arch,
    ffmpeg: {
      present: ffmpegPresent,
      path: ffmpegPresent ? binaries.ffmpeg : null,
      version: ffmpegVersion,
    },
    engines: [
      { id: 'ffmpeg', available: ffmpegPresent },
      { id: 'sharp', available: true },
    ] as { id: ConversionEngineId; available: boolean }[],
  };
  logger.debug('app-info', `built app info (ffmpeg present=${ffmpegPresent})`);
  return cached;
}
