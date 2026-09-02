import { randomUUID } from 'node:crypto';
import { rmSync, statSync } from 'node:fs';
import { encodeWithinBudget, isValidCompressionOptions, bytesToMb } from '@conversion/compress';
import type { ConversionTask, EngineBundle } from '@conversion/engine';
import { probeMedia } from '@conversion/ffmpeg/probe';
import { ConversionService } from '@conversion/service';
import { detectPath } from '@core/detect';
import type { InternalJob } from '@core/job';
import { complete, fail, setProgress, start, cancel } from '@core/job';
import { JobQueue } from '@core/queue';
import { FORMATS_BY_CATEGORY } from '@shared/formats';
import type {
  QueueSnapshot,
  StartConversionRequest,
  ConversionRequestItem,
  CompressionOptions,
} from '@shared/ipc';
import type { AppErrorCode, MediaCategory, TargetFormat } from '@shared/types';
import { logger } from '../logger';
import { resolveAndReserveOutput, validateInput } from './output-resolver';

const MAX_COMPRESSION_ATTEMPTS = 6;
const RETRY_BUDGET_RATIO = 0.82;

export interface StartResult {
  created: number;
  rejected: { inputPath: string; error: AppErrorCode }[];
  snapshot: QueueSnapshot;
}

export type SnapshotListener = (snapshot: QueueSnapshot) => void;

export interface ConversionManagerOptions {
  bundle: EngineBundle;
  ffprobeBin: string;
  concurrency?: number;
}

const DEFAULT_CONCURRENCY = 2;

function makeTask(job: InternalJob, compression?: ConversionTask['compression']): ConversionTask {
  return {
    id: job.id,
    inputPath: job.inputPath,
    outputPath: job.outputPath as string,
    sourceExtension: job.sourceExtension,
    category: job.category,
    targetFormat: job.targetFormat,
    quality: job.quality,
    durationMs: null,
    compression,
  };
}

function fileSizeMb(inputPath: string): number | null {
  try {
    return bytesToMb(statSync(inputPath).size);
  } catch {
    return null;
  }
}

function inputFileName(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function categoryOf(targetFormat: TargetFormat): MediaCategory {
  if (
    targetFormat === 'jpg' ||
    targetFormat === 'png' ||
    targetFormat === 'webp' ||
    targetFormat === 'avif'
  ) {
    return 'image';
  }
  if (
    targetFormat === 'mp4' ||
    targetFormat === 'mov' ||
    targetFormat === 'mkv' ||
    targetFormat === 'webm'
  ) {
    return 'video';
  }
  return 'audio';
}

export class ConversionManager {
  private readonly queue = new JobQueue();
  private readonly service: ConversionService;
  private readonly concurrency: number;
  private readonly ffprobeBin: string;
  private running = 0;
  private cancelHandlers = new Map<string, () => void>();
  private listener: SnapshotListener | null = null;

  constructor(opts: ConversionManagerOptions) {
    this.concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
    this.service = new ConversionService({ bundle: opts.bundle });
    this.ffprobeBin = opts.ffprobeBin;
  }

  setListener(listener: SnapshotListener): void {
    this.listener = listener;
    this.broadcast();
  }

  start(request: StartConversionRequest): StartResult {
    const rejected: { inputPath: string; error: AppErrorCode }[] = [];
    let created = 0;

    for (const item of request.items) {
      const outcome = this.enqueue(item, request.destination);
      if (outcome.ok) created++;
      else rejected.push({ inputPath: item.inputPath, error: outcome.error });
    }

    this.pump();
    this.broadcast();
    return { created, rejected, snapshot: this.currentSnapshot() };
  }

  cancelJob(jobId: string): void {
    const result = this.queue.requestCancel(jobId);
    if (result.status === 'processing') {
      this.cancelHandlers.get(jobId)?.();
    }
    this.pump();
    this.broadcast();
  }

  cancelAll(): void {
    for (const job of this.queue.all()) {
      if (job.status === 'processing') this.cancelHandlers.get(job.id)?.();
      else if (job.status === 'pending') this.queue.requestCancel(job.id);
    }
    this.pump();
    this.broadcast();
  }

  clearCompleted(): void {
    this.queue.clearCompleted();
    this.broadcast();
  }

  snapshot(): QueueSnapshot {
    return this.currentSnapshot();
  }

  private currentSnapshot(): QueueSnapshot {
    return this.queue.snapshot(this.running > 0, this.running);
  }

  private broadcast(): void {
    this.listener?.(this.currentSnapshot());
  }

  private enqueue(
    item: ConversionRequestItem,
    destination: string | null,
  ): { ok: true } | { ok: false; error: AppErrorCode } {
    const detected = detectPath(item.inputPath);
    if (!detected) {
      return { ok: false, error: 'UNSUPPORTED_SOURCE' };
    }
    const category = categoryOf(item.targetFormat);
    if (!FORMATS_BY_CATEGORY[category].some((f) => f.id === item.targetFormat)) {
      return { ok: false, error: 'INVALID_REQUEST' };
    }
    if (item.compression !== undefined && !isValidCompressionOptions(item.compression)) {
      return { ok: false, error: 'INVALID_REQUEST' };
    }
    const inputValid = validateInput(item.inputPath);
    if (!inputValid.ok) return { ok: false, error: inputValid.error };

    const name = inputFileName(item.inputPath);
    const reserved = resolveAndReserveOutput(item.inputPath, item.targetFormat, destination);
    if (!reserved.ok) return { ok: false, error: reserved.error };

    const job = this.queue.add({
      id: randomUUID(),
      name,
      sourceExtension: detected.extension,
      category,
      targetFormat: item.targetFormat,
      quality: item.quality,
      inputPath: item.inputPath,
      compression: item.compression,
    });
    job.outputPath = reserved.outputPath;
    logger.debug('manager', `enqueued ${name} -> ${reserved.outputPath}`);
    return { ok: true };
  }

  private pump(): void {
    while (this.running < this.concurrency) {
      const job = this.queue.next();
      if (!job) break;
      void this.run(job);
    }
  }

  private async probeTask(job: InternalJob): Promise<{
    sizeBytes: number;
    durationMs: number | null;
    hasVideo: boolean;
    hasAudio: boolean;
  }> {
    let sizeBytes = 0;
    try {
      sizeBytes = statSync(job.inputPath).size;
    } catch {
      sizeBytes = 0;
    }

    let probe = { durationMs: null as number | null, hasVideo: false, hasAudio: false };
    if (job.category !== 'image') {
      probe = await probeMedia(this.ffprobeBin, job.inputPath);
    }
    return { sizeBytes, ...probe };
  }

  private compressionPlan(
    job: InternalJob,
    probe: { sizeBytes: number; durationMs: number | null; hasVideo: boolean; hasAudio: boolean },
    budgetMb: number,
  ): ConversionTask['compression'] {
    return {
      maxSizeMb: (job.compression as CompressionOptions).maxSizeMb,
      encode: encodeWithinBudget({
        category: job.category,
        targetFormat: job.targetFormat,
        budgetMb,
        sizeBytes: probe.sizeBytes,
        durationMs: probe.durationMs,
        hasAudio: probe.hasAudio,
      }),
    };
  }

  private async runCompression(
    task: ConversionTask,
    job: InternalJob,
  ): Promise<{
    ok: boolean;
    cancelled: boolean;
    code: AppErrorCode | null;
    message: string | null;
  }> {
    const maxSizeMb = (job.compression as CompressionOptions).maxSizeMb;
    const probe = await this.probeTask(job);

    let budget = maxSizeMb;
    for (let attempt = 0; attempt < MAX_COMPRESSION_ATTEMPTS; attempt++) {
      if (attempt > 0) budget = budget * RETRY_BUDGET_RATIO;
      task.compression = this.compressionPlan(job, probe, budget);

      const handle = this.service.execute(task, (value) => {
        const current = this.queue.get(task.id);
        if (current) this.queue.replace(setProgress(current, value));
        this.broadcast();
      });
      this.cancelHandlers.set(task.id, () => handle.cancel());

      const result = await handle.finished;
      this.cancelHandlers.delete(task.id);

      if (job.status === 'cancelled') {
        return { ok: false, cancelled: true, code: 'JOB_CANCELLED', message: null };
      }
      if (!result.ok) {
        if (result.errorCode === 'JOB_CANCELLED') {
          return { ok: false, cancelled: true, code: 'JOB_CANCELLED', message: null };
        }
        return {
          ok: false,
          cancelled: false,
          code: result.errorCode ?? 'ENCODE_FAILED',
          message: result.errorMessage,
        };
      }

      const sizeMb = fileSizeMb(task.outputPath);
      if (sizeMb !== null && sizeMb <= maxSizeMb) {
        return { ok: true, cancelled: false, code: null, message: null };
      }
    }

    logger.warn(
      'manager',
      `compression impossible for ${job.name}: max ${maxSizeMb}MB too low for acceptable quality`,
    );
    try {
      rmSync(task.outputPath, { force: true });
    } catch {
      void 0;
    }
    return {
      ok: false,
      cancelled: false,
      code: 'ENCODE_FAILED',
      message:
        'O tamanho máximo informado é muito baixo para produzir um arquivo com qualidade aceitável. Aumente o limite.',
    };
  }

  private async run(job: InternalJob): Promise<void> {
    this.running++;
    this.broadcast();

    const started = start(job);
    this.queue.replace(started);
    this.broadcast();

    const task = makeTask(started, undefined);

    let result: { code: AppErrorCode | null; message: string | null; ok: boolean };

    if (started.compression) {
      result = await this.runCompression(task, started);
    } else {
      const handle = this.service.execute(task, (value) => {
        const current = this.queue.get(task.id);
        if (current) this.queue.replace(setProgress(current, value));
        this.broadcast();
      });
      this.cancelHandlers.set(task.id, () => handle.cancel());
      const res = await handle.finished;
      this.cancelHandlers.delete(task.id);
      if (res.ok) result = { code: null, message: null, ok: true };
      else if (res.errorCode === 'JOB_CANCELLED') {
        result = { code: 'JOB_CANCELLED', message: null, ok: false };
      } else {
        result = { code: res.errorCode ?? 'ENCODE_FAILED', message: res.errorMessage, ok: false };
      }
    }

    const current = this.queue.get(started.id);
    if (current) {
      const finalJob = result.ok
        ? complete(current, task.outputPath as string)
        : result.code === 'JOB_CANCELLED'
          ? cancel(current)
          : fail(current, (result.code ?? 'ENCODE_FAILED') as AppErrorCode, result.message);
      this.queue.replace(finalJob);
      logger.debug(
        'manager',
        `job ${finalJob.id} -> ${finalJob.status}${finalJob.errorMessage ? `: ${finalJob.errorMessage}` : ''}`,
      );
    }

    this.running--;
    this.broadcast();
    this.pump();
  }
}
