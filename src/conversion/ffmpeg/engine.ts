import { existsSync, rmSync, statSync } from 'node:fs';
import { createLineReader, createTailBuffer, spawnTracked } from '../../platform/process';
import type {
  ConversionEngine,
  EngineHandle,
  EngineRunResult,
  ConversionTask,
  ProgressReporter,
} from '../engine';
import { buildFfmpegArgs } from './args';
import { computeProgress, parseProgressChunk } from './progress';
import { probeDuration } from './probe';

const ERROR_HINTS = /error|invalid|not found|no such|exists|refused|failed|permission/i;

function binaryAvailable(bin: string): boolean {
  try {
    return existsSync(bin) && statSync(bin).isFile();
  } catch {
    return false;
  }
}

function outputSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function lastMeaningfulLine(content: string): string | null {
  const lines = content.split('\n').filter((l) => l.trim() !== '');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line && ERROR_HINTS.test(line)) return line.trim();
  }
  return lines[lines.length - 1]?.trim() ?? null;
}

export interface FfmpegEngineOptions {
  ffmpegBin: string;
  ffprobeBin: string;
}

export function createFfmpegEngine(opts: FfmpegEngineOptions): ConversionEngine {
  return {
    id: 'ffmpeg',
    convert(task: ConversionTask, onProgress: ProgressReporter): EngineHandle {
      if (!binaryAvailable(opts.ffmpegBin)) {
        const unavailable: EngineRunResult = {
          ok: false,
          errorCode: 'FFMPEG_NOT_FOUND',
          errorMessage: null,
        };
        return { finished: Promise.resolve(unavailable), cancel() {} };
      }

      let cancelled = false;

      const removePartial = () => {
        try {
          rmSync(task.outputPath, { force: true });
        } catch {
          void 0;
        }
      };

      let durationMs: number | null = task.durationMs;
      if (durationMs === null) {
        void probeDuration(opts.ffprobeBin, task.inputPath).then((probed) => {
          if (probed !== null) durationMs = probed;
        });
      }

      const tail = createTailBuffer(30);
      const processed = spawnTracked(opts.ffmpegBin, buildFfmpegArgs(task), {
        onStdout: (chunk) => {
          for (const line of createLineReader().push(chunk.toString('utf8'))) {
            const sample = parseProgressChunk(line);
            if (sample.outTimeUs !== null) {
              const pct = computeProgress(sample.outTimeUs, durationMs);
              if (pct !== null) onProgress(pct);
            }
          }
        },
        onStderr: (chunk) => {
          for (const line of chunk.toString('utf8').split('\n')) tail.push(line);
        },
      });

      const finished: Promise<EngineRunResult> = processed.exited.then(({ code, signal }) => {
        if (cancelled || signal === 'SIGKILL') {
          removePartial();
          return { ok: false, errorCode: 'JOB_CANCELLED', errorMessage: null };
        }
        if (code === null && signal === null) {
          removePartial();
          return { ok: false, errorCode: 'FFMPEG_NOT_FOUND', errorMessage: null };
        }
        if (code === 0) {
          if (outputSize(task.outputPath) <= 0) {
            removePartial();
            return {
              ok: false,
              errorCode: 'OUTPUT_NOT_CREATED',
              errorMessage: 'O ffmpeg reportou sucesso, mas nenhum arquivo de saída foi gerado.',
            };
          }
          onProgress(100);
          return { ok: true, errorCode: null, errorMessage: null };
        }
        removePartial();
        const message = lastMeaningfulLine(tail.content()) ?? 'O ffmpeg encerrou inesperadamente.';
        return { ok: false, errorCode: 'ENCODE_FAILED', errorMessage: message };
      });

      return {
        finished,
        cancel() {
          cancelled = true;
          processed.kill();
        },
      };
    },
  };
}
