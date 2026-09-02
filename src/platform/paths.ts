import { existsSync } from 'node:fs';
import { executableSuffix, platformArchKey, type NodeArch, type NodePlatform } from './info';

export const FFMPEG_DIR_NAME = 'ffmpeg';

export function ffmpegResourceDir(baseDir: string, platform: NodePlatform, arch: NodeArch): string {
  return `${baseDir}/${FFMPEG_DIR_NAME}/${platformArchKey(platform, arch)}`;
}

export interface FfmpegBinaries {
  ffmpeg: string;
  ffprobe: string;
  platform: NodePlatform;
  arch: NodeArch;
  present: boolean;
}

export function resolveFfmpegBinaries(
  baseDir: string,
  platform: NodePlatform,
  arch: NodeArch,
): FfmpegBinaries {
  const dir = ffmpegResourceDir(baseDir, platform, arch);
  const suffix = executableSuffix(platform);
  const ffmpeg = `${dir}/ffmpeg${suffix}`;
  const ffprobe = `${dir}/ffprobe${suffix}`;
  return { ffmpeg, ffprobe, platform, arch, present: existsSync(ffmpeg) && existsSync(ffprobe) };
}
