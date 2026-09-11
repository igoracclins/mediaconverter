import { createHash } from 'node:crypto';
import {
  createWriteStream,
  openSync,
  readSync,
  closeSync,
  readFileSync,
  writeFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJ_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sources.json');
const RESOURCES_DIR = path.join(PROJ_ROOT, 'resources', 'ffmpeg');

const KNOWN_TARGETS = ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'];

function mapCurrentTarget() {
  return `${process.platform}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function sha256Of(file) {
  const hash = createHash('sha256');
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(512 * 1024);
    let bytes;
    while ((bytes = readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, bytes));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

async function download(url, dest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  } finally {
    clearTimeout(timeout);
  }
}

function findBinary(dir, match) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'doc') continue;
        stack.push(full);
      } else if (entry.name === match) {
        return full;
      }
    }
  }
  return null;
}

function runExtract(args) {
  return spawnSync(args.shift(), args, { stdio: 'ignore' });
}
function extractArchive(archive, workDir) {
  const result =
    process.platform === 'win32'
      ? runExtract(['tar', '-xf', archive, '-C', workDir])
      : archive.endsWith('.tar.xz') || archive.endsWith('.txz')
        ? runExtract(['tar', '-xJf', archive, '-C', workDir])
        : runExtract(['unzip', '-oq', archive, '-d', workDir]);
  if (result.status !== 0) {
    throw new Error(`Extraction failed for ${archive}${result.stderr ? `\n${result.stderr}` : ''}`);
  }
}

function stripQuarantine(file) {
  if (process.platform !== 'darwin') return;
  spawnSync('xattr', ['-dr', 'com.apple.quarantine', file], { stdio: 'ignore' });
}

async function installEntry(key, entry) {
  const dir = path.join(RESOURCES_DIR, key);
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, entry.match);

  if (existsSync(dest) && !hasFlag('--force')) {
    console.log(`  ok  ${path.relative(PROJ_ROOT, dest)} (already present)`);
    return { dest, downloaded: false };
  }

  const archiveName = path.basename(new URL(entry.url).pathname);
  const tmpDir = path.join(tmpdir(), 'ffmpeg-prepare');
  mkdirSync(tmpDir, { recursive: true });
  const archiveTmp = path.join(tmpDir, `${key}-${archiveName}`);
  const archiveStamp = `${archiveTmp}.sha256`;
  const workDir = path.join(tmpDir, `extract-${key}-${archiveName.replace(/\W+/g, '-')}`);

  try {
    rmSync(workDir, { recursive: true, force: true });
    mkdirSync(workDir, { recursive: true });

    if (!existsSync(archiveStamp) || hasFlag('--force')) {
      console.log(`  dl  ${entry.url}`);
      await download(entry.url, archiveTmp);
      const digest = sha256Of(archiveTmp);
      if (digest !== entry.sha256) {
        rmSync(archiveTmp, { force: true });
        throw new Error(
          `sha256 mismatch for ${entry.url}\n  expected ${entry.sha256}\n  received   ${digest}`,
        );
      }
      writeFileSync(archiveStamp, digest, 'utf8');
    } else {
      console.log('  ok  cached archive (checksum verified earlier)');
    }

    extractArchive(archiveTmp, workDir);
    const binary = findBinary(workDir, entry.match);
    if (!binary) {
      throw new Error(`Could not locate "${entry.match}" inside ${archiveName}`);
    }
    cpSync(binary, dest);
    if (process.platform !== 'win32') spawnSync('chmod', ['+x', dest], { stdio: 'ignore' });
    stripQuarantine(dest);
    console.log(`  ok  ${path.relative(PROJ_ROOT, dest)}`);
    return { dest, downloaded: true };
  } catch (err) {
    rmSync(workDir, { recursive: true, force: true });
    throw err;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));

  const flagArg = process.argv.find((a) => a.startsWith('--target='));
  const target = flagArg ? flagArg.split('=')[1] : mapCurrentTarget();
  if (!KNOWN_TARGETS.includes(target)) {
    console.error(`Unknown target "${target}". Use one of: ${KNOWN_TARGETS.join(', ')}`);
    process.exit(1);
  }

  console.log(`Preparing FFmpeg for ${target}`);
  const results = [];
  for (const entry of sources[target].files) {
    results.push(await installEntry(target, entry));
  }
  const newCount = results.filter((r) => r.downloaded).length;
  console.log(
    newCount > 0
      ? `\nInstalled ${newCount} new binary(-ies) for ${target}.`
      : `\nNothing to install for ${target}.`,
  );
}

main().catch((err) => {
  console.error(`\nprepare failed: ${err.message}`);
  process.exit(1);
});
