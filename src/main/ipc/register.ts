import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { isValidCompressionOptions, parseTargetSizeMb } from '@conversion/compress';
import { formatFromValue, qualityFromValue } from '@shared/formats';
import {
  IPC,
  type CompressionEstimateRequest,
  type EstimateCompressionResult,
  type StartConversionRequest,
  type QueueSnapshot,
  type StartConversionResult,
} from '@shared/ipc';
import { getAppInfo } from '../services/app-info';
import { estimateCompression } from '../services/compression-estimate';
import { inspectFiles, openFilesDialog } from '../services/file-service';
import type { ConversionManager } from '../services/conversion-manager';
import type { Operation } from '@shared/types';
import { logger } from '../logger';

export interface IpcDependencies {
  manager: ConversionManager;
  resourcesBaseDir: string;
  ffprobeBin: string;
  getWindow: () => BrowserWindow;
}

const OPERATIONS: readonly Operation[] = ['convert', 'compress', 'extract'];

function operationFromValue(value: unknown): Operation | null {
  return OPERATIONS.includes(value as Operation) ? (value as Operation) : null;
}

function isRequestItem(value: unknown, operation: Operation): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  if (operation === 'extract') return false;
  if (typeof item.inputPath !== 'string' || item.inputPath.length === 0) return false;
  if (formatFromValue(item.targetFormat) === null) return false;
  if (qualityFromValue(item.quality) === null) return false;
  if (operation === 'compress') {
    if (item.compression === undefined || !isValidCompressionOptions(item.compression)) return false;
  } else if (item.compression !== undefined) {
    return false;
  }
  return true;
}

function isStartRequest(value: unknown): value is StartConversionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const req = value as Record<string, unknown>;
  const operation = operationFromValue(req.operation);
  if (operation === null || operation === 'extract') return false;
  if (!Array.isArray(req.items) || req.items.length === 0) return false;
  if (!req.items.every((item) => isRequestItem(item, operation))) return false;
  const destination = req.destination;
  return destination === null || (typeof destination === 'string' && destination.length > 0);
}

function isEstimateRequest(value: unknown): value is CompressionEstimateRequest {
  if (typeof value !== 'object' || value === null) return false;
  const req = value as Record<string, unknown>;
  if (typeof req.inputPath !== 'string' || req.inputPath.length === 0) return false;
  if (formatFromValue(req.targetFormat) === null) return false;
  return parseTargetSizeMb(req.maxSizeMb) !== null && typeof req.maxSizeMb === 'number';
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return false;
    const senderFrame = event.senderFrame;
    if (senderFrame && senderFrame !== event.sender.mainFrame) return false;
    return true;
  } catch {
    return false;
  }
}

export function registerIpc(deps: IpcDependencies): void {
  const { manager } = deps;

  ipcMain.handle(IPC.AppInfo, () => getAppInfo({ resourcesBaseDir: deps.resourcesBaseDir }));

  ipcMain.handle(IPC.OpenFiles, (event) => {
    if (!isTrustedSender(event)) return { cancelled: true, files: [] };
    const win = BrowserWindow.fromWebContents(event.sender) ?? deps.getWindow();
    return openFilesDialog(win);
  });

  ipcMain.handle(IPC.InspectFiles, (event, paths: unknown) => {
    if (!isTrustedSender(event)) return { files: [], rejected: [] };
    if (!Array.isArray(paths)) return { files: [], rejected: [] };
    return inspectFiles(paths.filter((p): p is string => typeof p === 'string'));
  });

  ipcMain.handle(
    IPC.EstimateCompression,
    async (event, request: unknown): Promise<EstimateCompressionResult> => {
      if (!isTrustedSender(event)) return { ok: false, error: 'INVALID_REQUEST' };
      if (!isEstimateRequest(request)) return { ok: false, error: 'INVALID_REQUEST' };
      try {
        const estimate = await estimateCompression(deps.ffprobeBin, request);
        return { ok: true, estimate };
      } catch (err) {
        logger.error('estimate', `compression estimate failed: ${String(err)}`);
        return { ok: false, error: 'INTERNAL' };
      }
    },
  );

  ipcMain.handle(IPC.StartConversion, (event, request: unknown): StartConversionResult => {
    if (!isTrustedSender(event)) return { ok: false, error: 'INVALID_REQUEST' };
    if (!isStartRequest(request)) {
      return { ok: false, error: 'INVALID_REQUEST' };
    }
    const result = manager.start(request);
    if (result.created === 0 && result.rejected.length > 0) {
      return { ok: false, error: result.rejected[0]?.error ?? 'INTERNAL' };
    }
    return { ok: true, created: result.created, rejected: result.rejected };
  });

  ipcMain.handle(IPC.CancelJob, (event, jobId: unknown) => {
    if (!isTrustedSender(event)) return;
    if (typeof jobId === 'string') manager.cancelJob(jobId);
  });

  ipcMain.handle(IPC.CancelAll, (event) => {
    if (!isTrustedSender(event)) return;
    manager.cancelAll();
  });

  ipcMain.handle(IPC.ClearCompleted, (event) => {
    if (!isTrustedSender(event)) return;
    manager.clearCompleted();
  });

  manager.setListener((snapshot: QueueSnapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.QueueUpdated, snapshot);
    }
  });

  logger.debug('ipc', 'handlers registered');
}
