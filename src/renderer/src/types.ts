import type { CompressionEstimate, FileDescriptor } from '@shared/ipc';

export interface CompressionDraftConfig {
  maxSizeRaw: string;
  estimate: CompressionEstimate | null;
  estimating: boolean;
  lastSyncKey: string | null;
}

export interface DraftItem extends FileDescriptor {
  compression?: CompressionDraftConfig;
}

export type { FileDescriptor };
