import type {
  ConversionTask,
  EngineBundle,
  EngineHandle,
  EngineRunResult,
  ProgressReporter,
} from './engine';
import { engineFor } from './engine';
import { createFfmpegEngine } from './ffmpeg/engine';
import { createSharpEngine } from './sharp/engine';

export function createEngineBundle(opts: { ffmpegBin: string; ffprobeBin: string }): EngineBundle {
  return {
    ffmpeg: createFfmpegEngine({ ffmpegBin: opts.ffmpegBin, ffprobeBin: opts.ffprobeBin }),
    sharp: createSharpEngine(),
  };
}

export interface ConversionServiceOptions {
  bundle: EngineBundle;
}

export class ConversionService {
  private readonly bundle: EngineBundle;

  constructor(opts: ConversionServiceOptions) {
    this.bundle = opts.bundle;
  }

  execute(task: ConversionTask, onProgress: ProgressReporter): EngineHandle {
    const engine = engineFor(task.category, this.bundle);
    if (!engine) {
      const unavailable: EngineRunResult = {
        ok: false,
        errorCode: 'ENGINE_UNAVAILABLE',
        errorMessage: null,
      };
      return { finished: Promise.resolve(unavailable), cancel() {} };
    }
    return engine.convert(task, onProgress);
  }

  asPromise(task: ConversionTask, onProgress: ProgressReporter): Promise<EngineRunResult> {
    return this.execute(task, onProgress).finished;
  }
}
