import { isextensionSupported } from '@shared/formats';
import type { MediaCategory } from '@shared/types';

export interface DetectedFile {
  path: string;
  name: string;
  extension: string;
  category: MediaCategory;
}

export function splitExtension(name: string): { base: string; ext: string | null } {
  const parts = name.split('.');
  if (parts.length <= 1) return { base: name, ext: null };
  if (parts[0] === '') return { base: name, ext: null };
  const ext = parts.pop() as string;
  if (ext === '') return { base: parts.join('.'), ext: null };
  return { base: parts.join('.'), ext };
}

export function detectPath(path: string): DetectedFile | null {
  if (!path) return null;
  let name: string;
  if (path.includes('/') || path.includes('\\')) {
    name = path.split(/[/\\]/).pop() ?? path;
  } else {
    name = path;
  }
  const { ext } = splitExtension(name);
  if (!ext) return null;
  const normalized = ext.toLowerCase();
  const category = isextensionSupported(normalized);
  if (!category) return null;
  return { path, name, extension: normalized, category };
}
