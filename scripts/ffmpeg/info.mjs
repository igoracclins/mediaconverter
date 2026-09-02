import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJ_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESOURCES_DIR = path.join(PROJ_ROOT, 'resources', 'ffmpeg');

const CHECK_ENCODERS = [
  'libmp3lame',
  'aac',
  'flac',
  'libvorbis',
  'libopus',
  'libx264',
  'libx265',
  'libvpx-vp9',
  'libsvtav1',
  'mjpeg',
  'png',
];

function currentTarget() {
  return `${process.platform}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
}

function run(bin, args) {
  return spawnSync(bin, args, { encoding: 'utf8', timeout: 30_000 });
}

async function main() {
  const target = currentTarget();
  const ffmpegBin = path.join(
    RESOURCES_DIR,
    target,
    `${target.startsWith('win32') ? 'ffmpeg.exe' : 'ffmpeg'}`,
  );
  const ffprobeBin = path.join(
    RESOURCES_DIR,
    target,
    `${target.startsWith('win32') ? 'ffprobe.exe' : 'ffprobe'}`,
  );

  if (!existsSync(ffmpegBin)) {
    console.error(`No FFmpeg prepared for ${target}. Run: pnpm ffmpeg:prepare --target=${target}`);
    process.exit(1);
  }

  console.log(`FFmpeg build for ${target}\n`);
  const version = run(ffmpegBin, ['-version']);
  console.log(version.stdout.split('\n').slice(0, 3).join('\n'));
  const config = version.stdout.split('\n').find((l) => l.startsWith('configuration'));
  if (config) {
    const flags = config
      .replace(/^configuration:/, '')
      .trim()
      .split(/\s+/)
      .filter((f) =>
        [
          '--enable-gpl',
          '--enable-libx264',
          '--enable-libx265',
          '--enable-libmp3lame',
          '--enable-libopus',
          '--enable-libvpx',
          '--enable-libsvtav1',
        ].includes(f),
      );
    console.log(`\nKey configure flags: ${flags.join(' ') || '(none found)'}`);
  }

  const encoders = run(ffmpegBin, ['-hide_banner', '-encoders']);
  if (encoders.status === 0) {
    console.log('\nEncoder availability for app targets:');
    for (const codec of CHECK_ENCODERS) {
      const ok = encoders.stdout.includes(codec);
      console.log(`  ${ok ? '✓' : '✗'}  ${codec}`);
    }
  }

  if (existsSync(ffprobeBin)) {
    const probe = run(ffprobeBin, ['-version']);
    console.log(`\nffprobe: ${probe.stdout.split('\n')[0]?.trim() ?? 'version output unreadable'}`);
  }
}

main().catch((err) => {
  console.error(`info failed: ${err.message}`);
  process.exit(1);
});
