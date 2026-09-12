import type { CompressionEstimate, FileDescriptor } from '@shared/ipc';

export interface CompressionDraftConfig {
  maxSizeRaw: string;
  estimate: CompressionEstimate | null;
  estimating: boolean;
  lastSyncKey: string | null;
}

export interface BaseDraft extends FileDescriptor {
  id: string;
}

export interface ConvertDraft extends BaseDraft {}

export interface CompressDraft extends BaseDraft {
  compression: CompressionDraftConfig;
}

export type { FileDescriptor };