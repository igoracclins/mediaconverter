import type {
  AppErrorCode,
  ConversionEngineId,
  JobStatus,
  MediaCategory,
  Operation,
  QualityPreset,
  TargetFormat,
} from './types';

export interface FileDescriptor {
  path: string;
  name: string;
  extension: string;
  category: MediaCategory;
  sizeBytes: number;
}

export interface CompressionOptions {
  maxSizeMb: number;
}

export interface AppInfo {
  appVersion: string;
  electronVersion: string;
  platform: string;
  arch: string;
  ffmpeg: {
    present: boolean;
    path: string | null;
    version: string | null;
  };
  engines: { id: ConversionEngineId; available: boolean }[];
}

export interface ConversionRequestItem {
  inputPath: string;
  targetFormat: TargetFormat;
  quality: QualityPreset;
  compression?: CompressionOptions;
}

export interface StartConversionRequest {
  operation: Operation;
  items: ConversionRequestItem[];
  destination: string | null;
}

export interface JobSnapshot {
  id: string;
  name: string;
  sourceExtension: string;
  category: MediaCategory;
  targetFormat: TargetFormat;
  quality: QualityPreset;
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

export interface QueueSnapshot {
  jobs: JobSnapshot[];
  running: boolean;
  activeCount: number;
}

export interface AddFilesResult {
  files: FileDescriptor[];
  rejected: { path: string; reason: AppErrorCode }[];
}

export interface SelectionResult {
  cancelled: boolean;
  files: FileDescriptor[];
}

export type CommandResult<T = void> = { ok: true; data: T } | { ok: false; error: AppErrorCode };

export type StartConversionResult =
  | { ok: true; created: number; rejected: { inputPath: string; error: AppErrorCode }[] }
  | { ok: false; error: AppErrorCode };

export type CompressionUnsupportedReason = 'invalid' | 'lossless-target' | 'no-duration';

export type CompressionEstimateStatus = 'ok' | 'aggressive' | 'impossible' | 'unsupported';

export interface CompressionEstimate {
  status: CompressionEstimateStatus;
  currentSizeMb: number;
  recommendedMinMb: number | null;
  hardMinMb: number | null;
  unsupportedReason?: CompressionUnsupportedReason;
}

export interface CompressionEstimateRequest {
  inputPath: string;
  targetFormat: TargetFormat;
  maxSizeMb: number;
}

export type EstimateCompressionResult =
  { ok: true; estimate: CompressionEstimate } | { ok: false; error: AppErrorCode };

export const IPC = {
  AppInfo: 'app:info',
  OpenFiles: 'dialog:open-files',
  InspectFiles: 'files:inspect',
  EstimateCompression: 'compression:estimate',
  StartConversion: 'conversion:start',
  CancelJob: 'conversion:cancel-job',
  CancelAll: 'conversion:cancel-all',
  ClearCompleted: 'queue:clear-completed',
  QueueUpdated: 'queue:updated',
} as const;

export interface RendererApi {
  getAppInfo(): Promise<AppInfo>;
  openFiles(): Promise<SelectionResult>;
  inspectFiles(paths: string[]): Promise<AddFilesResult>;
  estimateCompression(request: CompressionEstimateRequest): Promise<EstimateCompressionResult>;
  getPathForFile(file: File): string;
  startConversion(request: StartConversionRequest): Promise<StartConversionResult>;
  cancelJob(jobId: string): Promise<void>;
  cancelAll(): Promise<void>;
  clearCompleted(): Promise<void>;
  onQueueUpdated(listener: (snapshot: QueueSnapshot) => void): () => void;
}
