import { existsSync, statSync } from 'node:fs';
import { BrowserWindow, dialog } from 'electron';
import { detectPath } from '@core/detect';
import type { AddFilesResult, FileDescriptor, SelectionResult } from '@shared/ipc';
import type { AppErrorCode } from '@shared/types';
import { logger } from '../logger';

export function inspectFiles(paths: readonly string[]): AddFilesResult {
  const files: FileDescriptor[] = [];
  const rejected: { path: string; reason: AppErrorCode }[] = [];
  const seen = new Set<string>();

  for (const rawPath of paths) {
    const inputPath = String(rawPath);
    if (seen.has(inputPath)) continue;
    seen.add(inputPath);

    if (!existsSync(inputPath)) {
      rejected.push({ path: inputPath, reason: 'MISSING_FILE' });
      continue;
    }

    try {
      if (!statSync(inputPath).isFile()) {
        rejected.push({ path: inputPath, reason: 'INVALID_PATH' });
        continue;
      }
    } catch {
      rejected.push({ path: inputPath, reason: 'MISSING_FILE' });
      continue;
    }

    const detected = detectPath(inputPath);
    if (!detected) {
      rejected.push({ path: inputPath, reason: 'UNSUPPORTED_SOURCE' });
      continue;
    }

    files.push({
      path: inputPath,
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
