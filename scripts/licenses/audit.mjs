#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'Apache 2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSD-3-Clause-Clear',
  'BSL-1.0',
  'CC0-1.0',
  'CC-BY-4.0',
  '0BSD',
  'Zlib',
  'Unlicense',
  'MPL-2.0',
  'WTFPL',
  'BlueOak-1.0.0',
  'Python-2.0',
  'X11',
]);

const FORBIDDEN = new Set([
  'GPL',
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'SSPL-1.0',
  'BUSL-1.1',
]);

const NOTICE = new Set(['LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'LGPL-3.0-or-later', 'LGPL-3.0-only']);

function normalize(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw))
    return raw.map((l) => (typeof l === 'object' && l?.type) || l).join(' OR ');
  if (typeof raw === 'object' && raw.type) return raw.type;
  return null;
}

function licenseFiles(dir) {
  const names = ['LICENSE', 'LICENCE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT', 'LICENSES'];
  const found = [];
  for (const n of names) {
    const p = path.join(dir, n);
    if (existsSync(p)) found.push(p);
  }
  return found;
}

function classify(declared) {
  const terms = declared
    .split(/\s+(?:AND|OR)\s+/i)
    .map((t) => t.replace(/[()]/g, '').trim())
    .filter(Boolean);
  if (terms.length === 0) return { unknown: true };
  if (terms.some((t) => FORBIDDEN.has(t))) return { forbidden: true };
  if (terms.every((t) => ALLOWED.has(t))) return { id: terms.join(' OR ') };
  if (terms.some((t) => NOTICE.has(t))) return { id: declared, notice: true };
  return { unknown: true };
}

function detectLicense(pkgDir) {
  const pkgPath = path.join(pkgDir, 'package.json');
  let info = null;
  if (existsSync(pkgPath)) {
    try {
      info = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      void 0;
    }
  }
  const declared = normalize(info?.license);
  if (declared && declared.startsWith('SEE LICENSE IN ')) {
    const file = path.join(pkgDir, declared.slice('SEE LICENSE IN '.length));
    return file && existsSync(file) ? { source: `${pkgPath} -> ${file}` } : { source: pkgPath };
  }
  if (declared) return classify(declared);

  const files = licenseFiles(pkgDir);
  if (files.length > 0) {
    const first = readFileSync(files[0], 'utf8').slice(0, 4000);
    for (const license of ALLOWED) {
      if (first.includes(license)) return { id: license, source: files[0] };
    }
    for (const license of FORBIDDEN) {
      if (first.includes(license)) return { id: license, source: files[0], forbidden: true };
    }
    for (const license of NOTICE) {
      if (first.includes(license)) return { id: license, source: files[0], notice: true };
    }
    return { id: 'unknown', source: files[0] };
  }
  return declared
    ? { id: declared, source: pkgPath, unknown: true }
    : { id: null, source: pkgPath, unknown: true };
}

const list = spawnSync('pnpm', ['list', '--prod', '--depth', 'Infinity', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
if (list.status !== 0) {
  console.error('audit: could not list production dependencies:', list.stderr || list.stdout);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(list.stdout);
} catch {
  console.error('audit: pnpm list output was not valid JSON');
  process.exit(1);
}

function collect(deps, out = new Map()) {
  for (const [name, entry] of Object.entries(deps ?? {})) {
    if (name && entry?.path) {
      const version = Array.isArray(entry.version) ? entry.version[0] : entry.version;
      const key = `${name}@${version}`;
      if (!out.has(key)) out.set(key, entry.path);
    }
    collect(entry?.dependencies, out);
  }
  return out;
}

const packages = collect(parsed[0]?.dependencies);

const failures = [];
const warnings = [];
const report = [];
let skipped = 0;
for (const [key, pkgDir] of [...packages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (!existsSync(pkgDir)) {
    skipped++;
    continue;
  }
  const result = detectLicense(pkgDir);
  report.push({ name: key, ...result, source: result.source ?? path.join(pkgDir, 'package.json') });
  if (result.forbidden) failures.push(`${key}: incompatible license ${result.id}`);
  else if (result.unknown) failures.push(`${key}: could not determine license`);
  else if (result.notice) warnings.push(`${key}: notice required (${result.id})`);
}

if (failures.length > 0) {
  console.error('audit: FAILED');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

for (const w of warnings) console.warn(`  ! ${w}`);

console.log(
  `audit: OK (${report.length} packaged production packages, all licenses compatible${skipped > 0 ? `; ${skipped} platform-specific not installed skipped` : ''})`,
);

const writeIndex = process.argv.indexOf('--write');
if (writeIndex > -1 && process.argv[writeIndex + 1]) {
  const seen = new Set();
  let md = '# Third-Party Notices\n\n';
  md += 'This document lists the production dependencies bundled by this application. ';
  md += 'The application runtime is Electron (MIT) plus its Chromium and Node.js components. ';
  md +=
    'Media conversion is performed by an external FFmpeg binary licensed under the GNU GPL v2 or later; ';
  md +=
    'that binary is distributed as a separate executable and is not part of this dependency tree. ';
  md += 'See `docs/licensing.md` for the full analysis.\n\n';
  for (const item of [...report].sort((a, b) => a.name.localeCompare(b.name))) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    md += `## ${item.name}\n\n`;
    md += `License: ${item.id ?? 'see source'}${item.notice ? ' (LGPL obligations apply)' : ''}\n\n`;
    md += `Source metadata: \`${path.relative(root, item.source)}\`\n\n`;
  }
  md += '## FFmpeg (bundled media engine)\n\n';
  md +=
    'Media conversion delegates to static FFmpeg/ffprobe binaries (configured with `--enable-gpl`), ';
  md +=
    'licensed under the GNU GPL v2 or later. They are invoked as separate external executables and ';
  md += 'are never linked into the application, which remains MIT licensed. ';
  md +=
    'The GPL license text and the corresponding-source offer ship in the application bundle under ';
  md +=
    '`licenses/ffmpeg/` (COPYING.GPLv2 and SOURCE.txt); provenance and sha256 checksums are pinned in ';
  md += '`scripts/ffmpeg/sources.json`. See `docs/licensing.md` for the full licensing analysis.\n';
  writeFileSync(path.resolve(root, process.argv[writeIndex + 1]), md);
  console.log(`audit: wrote ${process.argv[writeIndex + 1]}`);
}
