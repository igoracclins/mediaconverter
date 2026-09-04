import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import { detectPath } from '@core/detect';
import type { AddFilesResult, FileDescriptor, SelectionResult } from '@shared/ipc';
import type { AppErrorCode } from '@shared/types';
import { logger } from '../logger';

function collectPathsFromTree(root: string): string[] {
  const collected: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let stats;
    try {
      stats = statSync(current);
    } catch {
      continue;
    }
    if (stats.isFile()) {
      collected.push(current);
      continue;
    }
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === '.ds_store' || entry === '.DS_Store') continue;
      stack.push(path.join(current, entry));
    }
  }
  return collected;
}

interface ExpandedPath {
  path: string;
  silent: boolean;
}

export function inspectFiles(paths: readonly string[]): AddFilesResult {
  const files: FileDescriptor[] = [];
  const rejected: { path: string; reason: AppErrorCode }[] = [];
  const seen = new Set<string>();
  const expanded: ExpandedPath[] = [];

  for (const rawPath of paths) {
    const inputPath = String(rawPath);
    if (seen.has(inputPath)) continue;
    seen.add(inputPath);

    if (!existsSync(inputPath)) {
      rejected.push({ path: inputPath, reason: 'MISSING_FILE' });
      continue;
    }

    let isFile = false;
    try {
      isFile = statSync(inputPath).isFile();
    } catch {
      rejected.push({ path: inputPath, reason: 'MISSING_FILE' });
      continue;
    }

    if (isFile) {
      expanded.push({ path: inputPath, silent: false });
    } else {
      logger.debug('files', `discovering media in directory ${inputPath}`);
      for (const filePath of collectPathsFromTree(inputPath)) {
        if (!seen.has(filePath)) {
          seen.add(filePath);
          expanded.push({ path: filePath, silent: true });
        }
      }
    }
  }

  for (const entry of expanded) {
    const detected = detectPath(entry.path);
    if (!detected) {
      if (!entry.silent) {
        rejected.push({ path: entry.path, reason: 'UNSUPPORTED_SOURCE' });
      }
      continue;
    }

    files.push({
      path: entry.path,
      name: detected.name,
      extension: detected.extension,
      category: detected.category,
    });
  }

  return { files, rejected };
}

export async function openFilesDialog(window: BrowserWindow): Promise<SelectionResult> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Adicionar arquivos de mídia',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Mídia',
        extensions: [
          'mp3',
          'wav',
          'm4a',
          'ogg',
          'flac',
          'mp4',
          'mov',
          'mkv',
          'webm',
          'jpg',
          'jpeg',
          'png',
          'webp',
          'avif',
        ],
      },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true, files: [] };
  }
  const inspected = inspectFiles(result.filePaths);
  logger.debug(
    'files',
    `opened ${inspected.files.length} file(s), ${inspected.rejected.length} rejected`,
  );
  return { cancelled: false, files: inspected.files };
}
