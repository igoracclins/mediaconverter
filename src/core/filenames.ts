import { splitExtension } from './detect';

// eslint-disable-next-line no-control-regex
const WINDOWS_RESERVED = /[<>:"/\\|?*\u0000-\u001f]/g;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export const DEFAULT_MAX_ATTEMPTS = 10_000;

export const CONVERTED_DIR = 'Convertidos';

export function sanitizeBaseName(base: string): string {
  let cleaned = base.replace(WINDOWS_RESERVED, '').trim();
  if (cleaned === '' || cleaned === '.') cleaned = 'output';
  cleaned = cleaned.replace(/[. ]+$/, '');
  if (WINDOWS_RESERVED_NAMES.test(cleaned)) cleaned = `_${cleaned}`;
  return cleaned || 'output';
}

export function targetFileName(inputName: string, targetExt: string): string {
  const { base } = splitExtension(inputName);
  const safe = sanitizeBaseName(base);
  return `${safe}.${targetExt.toLowerCase().replace(/^\./, '')}`;
}

export function nextAvailableName(
  baseName: string,
  ext: string,
  existing: ReadonlySet<string>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): string {
  const normalizedExt = ext.toLowerCase().replace(/^\./, '');
  let candidate = `${baseName}.${normalizedExt}`;
  if (!existing.has(candidate)) return candidate;

  for (let i = 1; i < maxAttempts; i++) {
    candidate = `${baseName} (${i}).${normalizedExt}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error('Could not allocate a unique output name within the attempt limit.');
}

export function normalizeDirectory(dir: string): string {
  return dir.replace(/[\\/]+$/, '').replace(/\\/g, '/');
}

export function resolveOutputPath(
  inputPath: string,
  targetExt: string,
  destDir: string | null,
): string {
  const normalizedInput = inputPath.replace(/\\/g, '/');
  const slash = normalizedInput.lastIndexOf('/');
  const base = slash >= 0 ? normalizedInput.slice(0, slash + 1) : '';
  const name = slash >= 0 ? normalizedInput.slice(slash + 1) : normalizedInput;
  const dir = destDir ? normalizeDirectory(destDir) : `${base.replace(/\/$/, '')}/${CONVERTED_DIR}`;
  const fileName = targetFileName(name, targetExt);
  return `${dir}/${fileName}`;
}
