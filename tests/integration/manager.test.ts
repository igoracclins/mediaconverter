import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createEngineBundle } from '@conversion/service';
import { ConversionManager } from '@main/services/conversion-manager';
import type { JobSnapshot, QueueSnapshot } from '@shared/ipc';

const platform = `${process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
const SUFFIX = process.platform === 'win32' ? '.exe' : '';
const ffmpegBin = path.resolve(`resources/ffmpeg/${platform}/ffmpeg${SUFFIX}`);
const ffprobeBin = path.resolve(`resources/ffmpeg/${platform}/ffprobe${SUFFIX}`);
const ffmpegReady = existsSync(ffmpegBin) && existsSync(ffprobeBin);

function run(ffmpeg: string, dir: string, args: string[]): boolean {
  const result = spawnSync(ffmpeg, args, { cwd: dir, encoding: 'utf8' });
  return result.status === 0;
}

function makeWav(ffmpeg: string, dir: string, file: string, freq: string, duration = '2'): boolean {
  return run(ffmpeg, dir, [
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${freq}:duration=${duration}`,
    '-ac',
    '2',
    '-ar',
    '44100',
    file,
  ]);
}

function waitFor(predicate: () => boolean, timeoutMs = 30_000, intervalMs = 60): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = (): void => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs)
        return reject(new Error('timeout waiting for queue to settle'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

const snapshotOf = (manager: ConversionManager): { snapshots: QueueSnapshot[] } => {
  const snapshots: QueueSnapshot[] = [];
  manager.setListener((snap) => snapshots.push(snap));
  return { snapshots };
};

describe.skipIf(!ffmpegReady)('ConversionManager (real pipeline)', () => {
  let workDir: string;
  let bundle: ReturnType<typeof createEngineBundle>;

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'mc-mgr-'));
    bundle = createEngineBundle({ ffmpegBin, ffprobeBin });
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('converts a batch with concurrency 2, broadcasting progress snapshots', async () => {
    const inputs = ['a.wav', 'b.wav'];
    for (const f of inputs)
      expect(makeWav(ffmpegBin, workDir, f, f === 'a.wav' ? '440' : '330')).toBe(true);

    const manager = new ConversionManager({ bundle, ffprobeBin, concurrency: 2 });
    const { snapshots } = snapshotOf(manager);

    const result = manager.start({
      items: [
        { inputPath: path.join(workDir, 'a.wav'), targetFormat: 'mp3', quality: 'high' },
        { inputPath: path.join(workDir, 'b.wav'), targetFormat: 'ogg', quality: 'medium' },
      ],
      destination: null,
    });

    expect(result.created).toBe(2);
    expect(result.rejected).toEqual([]);

    await waitFor(() => {
      const jobs = manager.snapshot().jobs;
      return (
        jobs.length > 0 &&
        jobs.every((j) => ['completed', 'failed', 'cancelled'].includes(j.status))
      );
    });

    const final = manager.snapshot();
    expect(final.jobs).toHaveLength(2);
    expect(final.jobs.every((j) => j.status === 'completed')).toBe(true);
    expect(existsSync(final.jobs[0]!.outputPath!)).toBe(true);
    expect(existsSync(final.jobs[1]!.outputPath!)).toBe(true);

    const everRunning =
      snapshots.some((s) => s.running === true) && snapshots.every((s) => s.activeCount <= 2);
    expect(everRunning).toBe(true);

    const progressSeen = snapshots.some((s) => s.jobs.some((j) => (j.progress ?? 0) > 0));
    expect(progressSeen).toBe(true);
  });

  it('compresses a wav to a size-targeted mp3', async () => {
    const input = path.join(workDir, 'song-long.wav');
    expect(makeWav(ffmpegBin, workDir, input, '523', '20')).toBe(true);

    const manager = new ConversionManager({ bundle, ffprobeBin, concurrency: 1 });
    snapshotOf(manager);
    const result = manager.start({
      items: [
        {
          inputPath: input,
          targetFormat: 'mp3',
          quality: 'high',
          compression: { maxSizeMb: 0.2 },
        },
      ],
      destination: null,
    });
    expect(result.created).toBe(1);
    expect(result.rejected).toEqual([]);

    await waitFor(() => {
      const jobs = manager.snapshot().jobs;
      return (
        jobs.length > 0 &&
        jobs.every((j) => ['completed', 'failed', 'cancelled'].includes(j.status))
      );
    });

    const final = manager.snapshot();
    const job = final.jobs[0]!;
    expect(job.status).toBe('completed');
    expect(job.compression?.maxSizeMb).toBe(0.2);
    expect(job.outputPath!).toContain('Convertidos');
    expect(existsSync(job.outputPath!)).toBe(true);

    const inSize = statSync(input).size;
    const outSize = statSync(job.outputPath!).size;
    expect(outSize).toBeGreaterThan(0);
    expect(outSize).toBeLessThan(inSize);
    expect(outSize).toBeLessThanOrEqual(0.2 * 1024 * 1024);
  });

  it('cancels a running job, removes partial output, and reports JOB_CANCELLED', async () => {
    const longVideo = path.join(workDir, 'long-source.mp4');
    expect(
      run(ffmpegBin, workDir, [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=60:size=640x480:rate=30',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'ultrafast',
        longVideo,
      ]),
    ).toBe(true);

    const manager = new ConversionManager({ bundle, ffprobeBin, concurrency: 1 });
    snapshotOf(manager);
    const result = manager.start({
      items: [{ inputPath: longVideo, targetFormat: 'mkv', quality: 'low' }],
      destination: null,
    });

    const queue = (): JobSnapshot[] => manager.snapshot().jobs;

    await waitFor(() => queue().some((j) => j.status === 'processing'));
    const processingJob = queue().find((j) => j.status === 'processing');
    expect(processingJob).toBeDefined();
    const processingId = processingJob!.id;
    expect(processingId).toBe(result.snapshot.jobs[0]!.id);

    const outputPath = queue().find((j) => j.id === processingId)!.outputPath!;
    await waitFor(() => existsSync(outputPath), 30_000, 100);

    manager.cancelJob(processingId);
    await waitFor(() => queue().some((j) => j.id === processingId && j.status === 'cancelled'));
    expect(existsSync(outputPath)).toBe(false);
  });
});
