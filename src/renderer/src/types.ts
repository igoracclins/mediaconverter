import type { FileDescriptor } from '@shared/ipc';

export interface CompressionDraftConfig {
  maxSizeRaw: string;
}

export interface BaseDraft extends FileDescriptor {
  id: string;
}

export type ConvertDraft = BaseDraft;

export type ExtractDraft = BaseDraft;

export interface CompressDraft extends BaseDraft {
  compression: CompressionDraftConfig;
}

export type { FileDescriptor };