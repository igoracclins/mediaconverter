import type { FileDescriptor } from '@shared/ipc';

export interface CompressionDraftConfig {
  maxSizeRaw: string;
}

export interface BaseDraft extends FileDescriptor {
  id: string;
}

export interface ConvertDraft extends BaseDraft {}

export interface ExtractDraft extends BaseDraft {}

export interface CompressDraft extends BaseDraft {
  compression: CompressionDraftConfig;
}

export type { FileDescriptor };