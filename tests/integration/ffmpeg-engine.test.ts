import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createEngineBundle } from '@conversion/service';
import type { ConversionTask } from '@conversion/engine';
import { probeDuration } from '@conversion/ffmpeg/probe';

const platform = `${process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
const SUFFIX = process.platform === 'win32' ? '.exe' : '';
const ffmpegBin = path.resolve(`resources/ffmpeg/${platform}/ffmpeg${SUFFIX}`);
const ffprobeBin = path.resolve(`resources/ffmpeg/${platform}/ffprobe${SUFFIX}`);
const ffmpegReady = existsSync(ffmpegBin) && existsSync(ffprobeBin);

function run(options: { dir: string; args: string[]; bin?: string }): {
  status: number | null;
  output: string;
} {
  const bin = options.bin ?? ffmpegBin;
  const result = spawnSync(bin, options.args, { cwd: options.dir, encoding: 'utf8' });
  return { status: result.status, output: result.stderr || result.stdout };
}

function makeTask(
  overrides: Partial<Omit<ConversionTask, 'id' | 'inputPath' | 'outputPath'>> & {
    inputPath: string;
    outputPath: string;
  },
): ConversionTask {
  return {
    id: 'it',
    sourceExtension: 'bin',
    category: 'audio',
    targetFormat: 'mp3',
    quality: 'high',
    durationMs: null,
    ...overrides,
  };
}

describe.skipIf(!ffmpegReady)('FFmpeg engine (real binary)', () => {
  let workDir: string;
  let bundle: ReturnType<typeof createEngineBundle>;

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'mc-it-'));
    bundle = createEngineBundle({ ffmpegBin, ffprobeBin });
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('converts a synthetic WAV to MP3 and reports 100% progress', async () => {
    const input = path.join(workDir, 'tone.wav');
    const made = run({
      dir: workDir,
      args: [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-ac',
        '2',
        '-ar',
        '44100',
        input,
      ],
    });
    expect(made.status).toBe(0);

    const output = path.join(workDir, 'tone.mp3');
    const progressValues: number[] = [];
    const handle = bundle.ffmpeg.convert(
      makeTask({ inputPath: input, outputPath: output, category: 'audio', targetFormat: 'mp3' }),
      (p) => {
        if (p !== null) progressValues.push(p);
      },
    );
    const result = await handle.finished;

    expect(result.ok).toBe(true);
    expect(existsSync(output)).toBe(true);
    expect(statSync(output).size).toBeGreaterThan(10_000);
    expect(progressValues).toContain(100);

    const duration = await probeDuration(ffprobeBin, output);
    expect(duration).not.toBeNull();
    expect(duration!).toBeGreaterThan(1900);
    expect(duration!).toBeLessThan(2200);
  });

  it('converts a synthetic video to MP4 (libx264)', async () => {
    const input = path.join(workDir, 'clip.mp4');
    const made = run({
      dir: workDir,
      args: [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=1:size=320x240:rate=15',
        '-pix_fmt',
        'yuv420p',
        input,
      ],
    });
    expect(made.status).toBe(0);

    const output = path.join(workDir, 'clip.webm');
    const result = await bundle.ffmpeg.convert(
      makeTask({ inputPath: input, outputPath: output, category: 'video', targetFormat: 'webm' }),
      () => undefined,
    ).finished;
    expect(result.ok, result.errorMessage ?? undefined).toBe(true);
    expect(existsSync(output)).toBe(true);
  });

  it('collision naming is not the engine’s concern (output pre-resolved)', async () => {
    const input = path.join(workDir, 'tone2.wav');
    const made = run({
      dir: workDir,
      args: ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', input],
    });
    expect(made.status).toBe(0);
    const output = path.join(workDir, 'tone2.flac');
    const result = await bundle.ffmpeg.convert(
      makeTask({ inputPath: input, outputPath: output, category: 'audio', targetFormat: 'flac' }),
      () => undefined,
    ).finished;
    expect(result.ok).toBe(true);
    expect(existsSync(output)).toBe(true);
  });

  it('cancels a running conversion and removes the partial output', async () => {
    const input = path.join(workDir, 'long.mp4');
    const made = run({
      dir: workDir,
      args: [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=30:size=640x480:rate=30',
        '-pix_fmt',
        'yuv420p',
        input,
      ],
    });
    expect(made.status).toBe(0);

    const output = path.join(workDir, 'long.mkv');
    const handle = bundle.ffmpeg.convert(
      makeTask({
        inputPath: input,
        outputPath: output,
        category: 'video',
        targetFormat: 'mkv',
        quality: 'low',
      }),
      () => undefined,
    );
    let finished = false;
    handle.finished.then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const existed = existsSync(output);
    handle.cancel();
    const result = await handle.finished;

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('JOB_CANCELLED');
    expect(finished).toBe(true);
    if (existed) expect(existsSync(output)).toBe(false);
  });
});
