import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJ_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sources.json');
const RESOURCES_DIR = path.join(PROJ_ROOT, 'resources', 'ffmpeg');

const REQUIRED_ENCODERS = [
  'libmp3lame',
  'aac',
  'flac',
  'libvorbis',
  'libopus',
  'libx264',
  'libx265',
  'libvpx-vp9',
  'libsvtav1',
  'libaom-av1',
  'mjpeg',
  'png',
  'bmp',
  'tiff',
];

function run(bin, args) {
  return spawnSync(bin, args, { encoding: 'utf8', timeout: 30_000 });
}

function check(targetKey) {
  const spec = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'))[targetKey];
  if (!spec) {
    console.error(`Unknown target ${targetKey}`);
    return true;
  }
  const dir = path.join(RESOURCES_DIR, targetKey);
  let failed = false;

  for (const entry of spec.files) {
    const bin = path.join(dir, entry.match);
    if (!existsSync(bin)) {
      console.log(
        `[WARN]    MISSING ${path.relative(PROJ_ROOT, bin)} (not prepared for this platform)`,
      );
      continue;
    }
    const out = run(bin, ['-version']);
    if (out.status !== 0) {
      console.log(
        `[FAIL]    ${path.relative(PROJ_ROOT, bin)} did not execute (exit ${out.status})`,
      );
      failed = true;
      continue;
    }
    const versionLine =
      out.stdout.split('\n').find((l) => l.includes('version')) ?? out.stdout.split('\n')[0];
    const license = out.stdout.includes('--enable-gpl') ? 'GPL' : 'non-GPL';
    console.log(
      `[PASS]    ${path.relative(PROJ_ROOT, bin)}\n          ${versionLine.trim()} (${license})`,
    );
  }

  const ffmpeg = path.join(
    dir,
    spec.files.some((f) => f.match === 'ffmpeg.exe') ? 'ffmpeg.exe' : 'ffmpeg',
  );
  if (!existsSync(ffmpeg)) {
    console.log('[WARN]    Encoder check skipped (ffmpeg not prepared)');
    return false;
  }
  const encOut = run(ffmpeg, ['-hide_banner', '-encoders']);
  if (encOut.status !== 0) {
    console.log('[FAIL]    Could not read the encoder list');
    return true;
  }
  const missing = REQUIRED_ENCODERS.filter((codec) => !encOut.stdout.includes(codec));
  if (missing.length > 0) {
    console.log(`[WARN]    Missing encoders: ${missing.join(', ')}`);
  } else {
    console.log('[PASS]    All required encoders available');
  }
  return failed;
}

async function main() {
  const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
  const flagArg = process.argv.find((a) => a.startsWith('--target='));
  const targets = flagArg
    ? [flagArg.split('=')[1]]
    : Object.keys(sources).filter((k) => k !== 'doc');

  let failed = false;
  for (const target of targets) {
    console.log(`\n== ${target} ==`);
    if (check(target)) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`verify failed: ${err.message}`);
  process.exit(1);
});
