import { ERROR_MESSAGES } from './formats';
import type { AppErrorCode } from './types';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly technical: string | null;

  constructor(code: AppErrorCode, technical: string | null = null) {
    super(ERROR_MESSAGES[code] ?? code);
    this.name = 'AppError';
    this.code = code;
    this.technical = technical;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toAppError(value: unknown, fallback: AppErrorCode = 'INTERNAL'): AppError {
  if (value instanceof AppError) return value;
  if (value instanceof Error) return new AppError(fallback, value.message);
  return new AppError(fallback, String(value));
}

export function userMessage(code: AppErrorCode): string {
  return ERROR_MESSAGES[code];
}
