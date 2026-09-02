import { readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { nextAvailableName, resolveOutputPath } from '@core/filenames';
import type { AppErrorCode } from '@shared/types';

export type DestinationResult =
  { ok: true; outputPath: string } | { ok: false; error: AppErrorCode };

export function resolveAndReserveOutput(
  inputPath: string,
  targetFormat: string,
  destDir: string | null,
): DestinationResult {
  const basePath = resolveOutputPath(inputPath, targetFormat, destDir);
  const slash = basePath.lastIndexOf('/');
  const dir = slash > 0 ? basePath.slice(0, slash) : '/';
  const plainName = slash >= 0 ? basePath.slice(slash + 1) : basePath;
  const ext = targetFormat.replace(/^\./, '');
  const base = plainName.replace(/\.[^.]*$/, '');

  let existing: Set<string>;
  try {
    if (existsSync(dir) && !statSync(dir).isDirectory()) {
      return { ok: false, error: 'INVALID_PATH' };
    }
    mkdirSync(dir, { recursive: true });
    existing = new Set(
      readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name),
    );
  } catch {
    return { ok: false, error: 'NO_WRITE_PERMISSION' };
  }

  let candidate = nextAvailableName(base, ext, existing);

  while (existsSync(path.join(dir, candidate))) {
    existing.add(candidate);
    candidate = nextAvailableName(base, ext, existing);
  }

  return { ok: true, outputPath: path.join(dir, candidate) };
}

export function validateInput(
  inputPath: string,
): { ok: true } | { ok: false; error: AppErrorCode; message: string } {
  if (!existsSync(inputPath))
    return { ok: false, error: 'MISSING_FILE', message: 'O arquivo de entrada não existe mais.' };
  try {
    statSync(inputPath);
    return { ok: true };
  } catch (err) {
    const code: AppErrorCode =
      (err as NodeJS.ErrnoException | null)?.code === 'EACCES' ? 'NO_WRITE_PERMISSION' : 'INTERNAL';
    return { ok: false, error: code, message: 'O arquivo de entrada não pode ser lido.' };
  }
}
