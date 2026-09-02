#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const ALLOWED_PRODUCTION = new Set(['sharp']);

const failures = [];
const warnings = [];

const exact = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function checkSet(name, entries) {
  for (const [dep, version] of Object.entries(entries ?? {})) {
    if (!exact.test(version)) {
      failures.push(`${name} "${dep}" is not pinned exactly: "${version}"`);
    }
  }
}

checkSet('dependency', pkg.dependencies);
checkSet('devDependency', pkg.devDependencies);

const prod = Object.keys(pkg.dependencies ?? {}).sort();
const allowed = [...ALLOWED_PRODUCTION].sort();
if (JSON.stringify(prod) !== JSON.stringify(allowed)) {
  failures.push(
    `production dependencies are not the approved set. expected=[${allowed}] found=[${prod}]`,
  );
}

if (!existsSync(path.join(root, 'pnpm-lock.yaml'))) {
  failures.push('pnpm-lock.yaml is missing');
}

if (!pkg.engines?.node) {
  warnings.push('package.json declares no engines.node constraint');
}

const plat =
  process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
if (!process.env.SKIP_FFMPEG_CHECK) {
  for (const binary of ['ffmpeg', 'ffprobe']) {
    const target = path.join(
      root,
      'resources',
      'ffmpeg',
      `${plat}-${arch}`,
      process.platform === 'win32' ? `${binary}.exe` : binary,
    );
    if (existsSync(target)) {
      const mode = statSync(target).mode & 0o111;
      if (mode === 0 && process.platform !== 'win32') {
        warnings.push(`${target} is not executable`);
      }
    } else {
      warnings.push(`FFmpeg ${binary} not prepared for ${plat}-${arch}; run pnpm ffmpeg:prepare`);
    }
  }
}

if (failures.length > 0) {
  console.error('check-deps: FAILED');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

for (const w of warnings) console.warn(`  ! ${w}`);
console.log(`check-deps: OK (${prod.length} production dependencies, all versions pinned)`);
if (warnings.length > 0) console.log(`check-deps: ${warnings.length} warning(s), none blocking`);
