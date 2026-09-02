import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { ConversionTask } from '../../engine';
import { createFfmpegEngine } from '../engine';

vi.mock('../../../platform/process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../platform/process')>();
  return { ...actual, spawnTracked: vi.fn() };
});
vi.mock('../probe', () => ({
  probeDuration: vi.fn().mockResolvedValue(null),
}));

import { spawnTracked } from '../../../platform/process';
import { probeDuration } from '../probe';

const spawnTrackedMock = spawnTracked as unknown as Mock;

type Exit = { code: number | null; signal: NodeJS.Signals | null };

function makeTask(
  dir: string,
  targetFormat = 'mp3',
  category: 'audio' | 'video' = 'audio',
): ConversionTask {
  return {
    id: 'eng',
    inputPath: path.join(dir, 'in.wav'),
    outputPath: path.join(dir, `out.${targetFormat}`),
    sourceExtension: 'wav',
    category,
    targetFormat: targetFormat as ConversionTask['targetFormat'],
    quality: 'high',
    durationMs: null,
  };
}

function bindSpawn(): { kill: Mock; setExited: (r: Exit) => void } {
  let resolveExit!: (r: Exit) => void;
  const kill = vi.fn();
  spawnTrackedMock.mockImplementation(() => ({
    exited: new Promise<Exit>((resolve) => {
      resolveExit = resolve;
    }),
    kill,
  }));
  return {
    kill,
    setExited: (r) => queueMicrotask(() => resolveExit(r)),
  };
}

function engineFor(dir: string, ffmpegBin = '/usr/bin/true') {
  return createFfmpegEngine({ ffmpegBin, ffprobeBin: '/usr/bin/true' });
}

describe('createFfmpegEngine', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-eng-'));
    spawnTrackedMock.mockReset();
    (probeDuration as unknown as Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports a successful conversion when the output exists and is non-empty', async () => {
    const task = makeTask(dir);
    writeFileSync(task.outputPath, 'payload');
    const { setExited } = bindSpawn();

    const handle = engineFor(dir).convert(task, () => undefined);
    setExited({ code: 0, signal: null });
    const result = await handle.finished;

    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeNull();
  });

  it('reports OUTPUT_NOT_CREATED when ffmpeg succeeds but no output file appears', async () => {
    const task = makeTask(dir);
    const { setExited } = bindSpawn();

    const handle = engineFor(dir).convert(task, () => undefined);
    setExited({ code: 0, signal: null });
    const result = await handle.finished;

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('OUTPUT_NOT_CREATED');
  });

  it('reports OUTPUT_NOT_CREATED when the output file exists but is empty', async () => {
    const task = makeTask(dir);
    writeFileSync(task.outputPath, '');
    const { setExited } = bindSpawn();

    const handle = engineFor(dir).convert(task, () => undefined);
    setExited({ code: 0, signal: null });
    const result = await handle.finished;

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('OUTPUT_NOT_CREATED');
  });

  it('reports FFMPEG_NOT_FOUND when the binary is unavailable, without spawning', async () => {
    const task = makeTask(dir);
    const handle = engineFor(dir, path.join(dir, 'does-not-exist')).convert(task, () => undefined);

    const result = await handle.finished;

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('FFMPEG_NOT_FOUND');
    expect(spawnTrackedMock).not.toHaveBeenCalled();
  });

  it('reports FFMPEG_NOT_FOUND when the process exits with neither code nor signal', async () => {
    const task = makeTask(dir);
    const { setExited } = bindSpawn();

    const handle = engineFor(dir).convert(task, () => undefined);
    setExited({ code: null, signal: null });
    const result = await handle.finished;

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('FFMPEG_NOT_FOUND');
  });

  it('reports JOB_CANCELLED, kills the process and removes the partial output on cancel', async () => {
    const task = makeTask(dir);
    writeFileSync(task.outputPath, 'partial');
    const { kill, setExited } = bindSpawn();

    const handle = engineFor(dir).convert(task, () => undefined);
    handle.cancel();
    expect(kill).toHaveBeenCalled();
    setExited({ code: null, signal: 'SIGKILL' });

    const result = await handle.finished;
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('JOB_CANCELLED');
  });
});
