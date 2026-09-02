import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserWindow } from 'electron';
import { IPC, type StartConversionRequest } from '@shared/ipc';
import { registerIpc, type IpcDependencies } from '../register';
import type { ConversionManager } from '../../services/conversion-manager';

const { handlers, windowMock, sendSpy, fromWebContents } = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  const sendSpy = vi.fn();
  const windowMock = { isDestroyed: () => false, webContents: { send: sendSpy } };
  const fromWebContents = vi.fn(() => windowMock);
  return { handlers, windowMock, sendSpy, fromWebContents };
});

type HandlerFn = (event: unknown, ...args: unknown[]) => unknown;

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    },
  },
  BrowserWindow: {
    fromWebContents,
    getAllWindows: () => [windowMock],
  },
}));

const managerMock = {
  start: vi.fn(),
  cancelJob: vi.fn(),
  cancelAll: vi.fn(),
  clearCompleted: vi.fn(),
  setListener: vi.fn(),
  snapshot: vi.fn(),
};

function makeDeps(): IpcDependencies {
  return {
    manager: managerMock as unknown as ConversionManager,
    resourcesBaseDir: '/tmp/resources',
    ffprobeBin: '/tmp/ffprobe',
    getWindow: () => windowMock as unknown as BrowserWindow,
  };
}

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({ sender: {}, frameId: 1 }, ...args);
}

async function invokeWithEvent(
  event: unknown,
  channel: string,
  ...args: unknown[]
): Promise<unknown> {
  const handler = handlers.get(channel) as HandlerFn | undefined;
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler(event, ...args);
}

describe('registerIpc', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    fromWebContents.mockReturnValue(windowMock);
    managerMock.start.mockReturnValue({
      created: 2,
      rejected: [],
      snapshot: { jobs: [], running: false, activeCount: 0 },
    });
  });

  it('registers all expected channels and wires the snapshot listener', () => {
    registerIpc(makeDeps());
    for (const channel of [
      IPC.AppInfo,
      IPC.OpenFiles,
      IPC.InspectFiles,
      IPC.EstimateCompression,
      IPC.StartConversion,
      IPC.CancelJob,
      IPC.CancelAll,
      IPC.ClearCompleted,
    ]) {
      expect(handlers.has(channel)).toBe(true);
    }
    const listener = managerMock.setListener.mock.calls[0]?.[0];
    expect(typeof listener).toBe('function');
    listener?.({ jobs: [], running: false, activeCount: 0 });
    expect(sendSpy).toHaveBeenCalledWith(IPC.QueueUpdated, expect.anything());
  });

  it('rejects malformed start requests', async () => {
    registerIpc(makeDeps());
    const result = (await invoke(IPC.StartConversion, { items: [] })) as {
      ok: boolean;
      error?: string;
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVALID_REQUEST');
    expect(managerMock.start).not.toHaveBeenCalled();
  });

  it('rejects malformed compression estimate requests', async () => {
    registerIpc(makeDeps());
    const cases: unknown[] = [
      { inputPath: '', targetFormat: 'mp3', maxSizeMb: 30 },
      { inputPath: '/tmp/a.wav', targetFormat: 'mp3', maxSizeMb: 0 },
      { inputPath: '/tmp/a.wav', targetFormat: 'mp3', maxSizeMb: -1 },
      { inputPath: '/tmp/a.wav', targetFormat: 'not-real', maxSizeMb: 30 },
      { inputPath: '/tmp/a.wav', targetFormat: 'mp3', preset: 'balanced' },
    ];
    for (const request of cases) {
      const result = (await invoke(IPC.EstimateCompression, request)) as {
        ok: boolean;
        error?: string;
      };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_REQUEST');
    }
  });

  it('returns a viability estimate for a valid compression request', async () => {
    registerIpc(makeDeps());
    const result = (await invoke(IPC.EstimateCompression, {
      inputPath: '/tmp/missing.wav',
      targetFormat: 'mp3',
      maxSizeMb: 30,
    })) as { ok: boolean; estimate?: { status: string } };
    expect(result.ok).toBe(true);
    expect(result.estimate?.status).toBe('unsupported');
  });

  it('reject start items with invalid compression payloads', async () => {
    registerIpc(makeDeps());
    const result = (await invoke(IPC.StartConversion, {
      items: [
        {
          inputPath: '/tmp/a.wav',
          targetFormat: 'mp3',
          quality: 'high',
          compression: { maxSizeMb: 0 },
        },
      ],
      destination: null,
    })) as { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVALID_REQUEST');
    expect(managerMock.start).not.toHaveBeenCalled();
  });

  it('forwards start requests that include valid compression options', async () => {
    registerIpc(makeDeps());
    const request: StartConversionRequest = {
      items: [
        {
          inputPath: '/tmp/a.wav',
          targetFormat: 'mp3',
          quality: 'high',
          compression: { maxSizeMb: 30 },
        },
      ],
      destination: null,
    };
    const result = (await invoke(IPC.StartConversion, request)) as { ok: boolean; created: number };
    expect(result.ok).toBe(true);
    expect(managerMock.start).toHaveBeenCalledWith(request);
  });

  it('forwards a valid start request and maps a fully-rejected result to an error', async () => {
    registerIpc(makeDeps());

    const request: StartConversionRequest = {
      items: [{ inputPath: '/tmp/a.wav', targetFormat: 'mp3', quality: 'high' }],
      destination: '/tmp/out',
    };
    const okResult = (await invoke(IPC.StartConversion, request)) as { ok: true; created: number };
    expect(managerMock.start).toHaveBeenCalledWith(request);
    expect(okResult.ok).toBe(true);
    expect(okResult.created).toBe(2);

    managerMock.start.mockReturnValue({
      created: 0,
      rejected: [{ inputPath: 'a.wav', error: 'UNSUPPORTED_SOURCE' }],
      snapshot: { jobs: [], running: false, activeCount: 0 },
    });
    const badResult = (await invoke(IPC.StartConversion, request)) as { ok: false; error: string };
    expect(badResult.ok).toBe(false);
    expect(badResult.error).toBe('UNSUPPORTED_SOURCE');
  });

  it('sanitizes InspectFiles input and routes cancel/clear calls', async () => {
    registerIpc(makeDeps());
    await invoke(IPC.InspectFiles, 'not-an-array');
    await invoke(IPC.InspectFiles, ['/tmp/a.wav', 42]);
    await invoke(IPC.CancelJob, 'job-1');
    await invoke(IPC.CancelJob, 12);
    await invoke(IPC.CancelAll);
    await invoke(IPC.ClearCompleted);
    expect(managerMock.cancelJob).toHaveBeenCalledWith('job-1');
    expect(managerMock.cancelJob).toHaveBeenCalledTimes(1);
    expect(managerMock.cancelAll).toHaveBeenCalledTimes(1);
    expect(managerMock.clearCompleted).toHaveBeenCalledTimes(1);
  });

  it('rejects sensitive channels from a non-top-level (sub-frame) sender', async () => {
    registerIpc(makeDeps());
    const mainFrame = { id: 1 };
    const event = {
      sender: { mainFrame, id: 1 },
      senderFrame: { id: 2 }, // sub-frame is not the top-level frame
    };

    const open = (await invokeWithEvent(event, IPC.OpenFiles)) as { cancelled: boolean };
    expect(open.cancelled).toBe(true);

    const estimate = (await invokeWithEvent(event, IPC.EstimateCompression, {
      inputPath: '/tmp/a.wav',
      targetFormat: 'mp3',
      targetSizeMb: 30,
      preset: 'balanced',
    })) as { ok: boolean; error?: string };
    expect(estimate.ok).toBe(false);
    expect(estimate.error).toBe('INVALID_REQUEST');

    const start = (await invokeWithEvent(event, IPC.StartConversion, {
      items: [{ inputPath: '/tmp/a.wav', targetFormat: 'mp3', quality: 'high' }],
      destination: '/tmp/out',
    })) as { ok: boolean; error?: string };
    expect(start.ok).toBe(false);
    expect(start.error).toBe('INVALID_REQUEST');
    expect(managerMock.start).not.toHaveBeenCalled();

    await invokeWithEvent(event, IPC.CancelJob, 'job-1');
    await invokeWithEvent(event, IPC.CancelAll);
    await invokeWithEvent(event, IPC.ClearCompleted);
    expect(managerMock.cancelJob).not.toHaveBeenCalled();
    expect(managerMock.cancelAll).not.toHaveBeenCalled();
    expect(managerMock.clearCompleted).not.toHaveBeenCalled();
  });

  it('rejects sensitive channels from an unknown / destroyed window sender', async () => {
    fromWebContents.mockReturnValue(null as never);
    registerIpc(makeDeps());

    const open = (await invoke(IPC.OpenFiles)) as { cancelled: boolean };
    expect(open.cancelled).toBe(true);

    const start = (await invoke(IPC.StartConversion, {
      items: [{ inputPath: '/tmp/a.wav', targetFormat: 'mp3', quality: 'high' }],
      destination: '/tmp/out',
    })) as { ok: boolean; error?: string };
    expect(start.ok).toBe(false);
    expect(managerMock.start).not.toHaveBeenCalled();
  });
});
