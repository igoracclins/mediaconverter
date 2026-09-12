import type { CompressionOptions, JobSnapshot } from '@shared/ipc';
import type {
  AppErrorCode,
  JobStatus,
  MediaCategory,
  Operation,
  QualityPreset,
  TargetFormat,
} from '@shared/types';

export interface CreateJobInput {
  id: string;
  operation: Operation;
  name: string;
  sourceExtension: string;
  category: MediaCategory;
  targetFormat: TargetFormat;
  quality: QualityPreset;
  inputPath: string;
  compression?: CompressionOptions;
}

export interface InternalJob {
  id: string;
  operation: Operation;
  name: string;
  sourceExtension: string;
  category: MediaCategory;
  targetFormat: TargetFormat;
  quality: QualityPreset;
  inputPath: string;
  status: JobStatus;
  progress: number | null;
  errorCode: AppErrorCode | null;
  errorMessage: string | null;
  outputPath: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  compression?: CompressionOptions;
}

export const VALID_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function createJob(input: CreateJobInput, now: number = Date.now()): InternalJob {
  return {
    id: input.id,
    operation: input.operation,
    name: input.name,
    sourceExtension: input.sourceExtension,
    category: input.category,
    targetFormat: input.targetFormat,
    quality: input.quality,
    inputPath: input.inputPath,
    status: 'pending',
    progress: null,
    errorCode: null,
    errorMessage: null,
    outputPath: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    compression: input.compression,
  };
}

export function transition(job: InternalJob, next: JobStatus): InternalJob {
  if (next === job.status) return job;
  const allowed = VALID_TRANSITIONS[job.status];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid job transition "${job.status}" -> "${next}" for job ${job.id}`);
  }
  const updated: InternalJob = { ...job, status: next };
  if (next === 'processing') updated.startedAt ??= Date.now();
  if (next === 'completed' || next === 'failed' || next === 'cancelled') {
    updated.finishedAt = Date.now();
  }
  return updated;
}

export function start(job: InternalJob): InternalJob {
  return transition(job, 'processing');
}

export function complete(job: InternalJob, outputPath: string): InternalJob {
  return { ...transition(job, 'completed'), outputPath };
}

export function fail(job: InternalJob, code: AppErrorCode, message: string | null): InternalJob {
  return {
    ...transition(job, 'failed'),
    errorCode: code,
    errorMessage: message,
  };
}

export function cancel(job: InternalJob, message = 'Conversão cancelada.'): InternalJob {
  return {
    ...transition(job, 'cancelled'),
    errorMessage: message,
  };
}

export function setProgress(job: InternalJob, progress: number | null): InternalJob {
  if (job.status !== 'processing') return job;
  const clamped = progress === null ? null : Math.min(100, Math.max(0, Math.round(progress)));
  return { ...job, progress: clamped };
}

export function snapshot(job: InternalJob): JobSnapshot {
  return {
    id: job.id,
    operation: job.operation,
    name: job.name,
    sourceExtension: job.sourceExtension,
    category: job.category,
    targetFormat: job.targetFormat,
    quality: job.quality,
    status: job.status,
    progress: job.progress,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    outputPath: job.outputPath,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    compression: job.compression,
  };
}
