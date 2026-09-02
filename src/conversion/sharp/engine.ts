import { rmSync } from 'node:fs';
import type {
  ConversionEngine,
  EngineHandle,
  EngineRunResult,
  ConversionTask,
  ProgressReporter,
} from '../engine';
import type { CompressionEncode } from '../compress';

type SharpFormatOptions = Record<string, unknown>;

const BASE_QUALITY: Record<string, Record<string, number> & { base: number }> = {
  jpg: { high: 90, medium: 80, low: 65, base: 80 },
  webp: { high: 90, medium: 80, low: 60, base: 80 },
  avif: { high: 60, medium: 45, low: 30, base: 45 },
};

function formatOptions(
  target: string,
  quality: string,
  encode?: CompressionEncode,
): SharpFormatOptions {
  const override = encode?.kind === 'image' ? encode.quality : null;
  const byPreset = BASE_QUALITY[target];
  const pick = (): number => override ?? byPreset?.[quality] ?? byPreset?.base ?? 80;
  switch (target) {
    case 'jpg':
      return { quality: pick(), mozjpeg: true };
    case 'png':
      return {
        compressionLevel:
          encode?.kind === 'lossless' ? 9 : ({ high: 9, medium: 6, low: 4 }[quality] ?? 6),
        palette: false,
      };
    case 'webp':
      return { quality: pick() };
    case 'avif':
      return { quality: pick(), effort: 6 };
    default:
      return {};
  }
}

export const createSharpEngine = (): ConversionEngine => {
  let sharpModulePromise: Promise<typeof import('sharp')> | null = null;

  return {
    id: 'sharp',
    convert(task: ConversionTask, onProgress: ProgressReporter): EngineHandle {
      let cancelled = false;

      const removePartial = () => {
        try {
          rmSync(task.outputPath, { force: true });
        } catch {
          void 0;
        }
      };

      const finished = (async (): Promise<EngineRunResult> => {
        if (!sharpModulePromise) sharpModulePromise = import('sharp');
        const sharp = (await sharpModulePromise).default;
        if (cancelled) {
          removePartial();
          return { ok: false, errorCode: 'JOB_CANCELLED', errorMessage: null };
        }
        try {
          await sharp(task.inputPath)
            .toFormat(
              task.targetFormat as 'jpeg' | 'png' | 'webp' | 'avif',
              formatOptions(task.targetFormat, task.quality, task.compression?.encode),
            )
            .toFile(task.outputPath);
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (cancelled) {
            removePartial();
            return { ok: false, errorCode: 'JOB_CANCELLED', errorMessage: null };
          }
          onProgress(100);
          return { ok: true, errorCode: null, errorMessage: null };
        } catch (err) {
          removePartial();
          const message = err instanceof Error ? err.message : String(err);
          return { ok: false, errorCode: 'ENCODE_FAILED', errorMessage: message };
        }
      })();

      return {
        finished,
        cancel() {
          cancelled = true;
          removePartial();
        },
      };
    },
  };
};
