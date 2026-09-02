import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: {},
  dialog: {},
}));

import { inspectFiles } from '../file-service';

describe('inspectFiles', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-fs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a supported media file', () => {
    const audio = path.join(dir, 'audio.ogg');
    writeFileSync(audio, 'data');
    const result = inspectFiles([audio]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({ path: audio, extension: 'ogg', category: 'audio' });
    expect(result.rejected).toHaveLength(0);
  });

  it('rejects directories as INVALID_PATH, not as media', () => {
    const subdir = path.join(dir, 'some-dir');
    mkdirSync(subdir);
    const result = inspectFiles([subdir]);
    expect(result.files).toHaveLength(0);
    expect(result.rejected).toEqual([{ path: subdir, reason: 'INVALID_PATH' }]);
  });

  it('rejects missing files as MISSING_FILE', () => {
    const missing = path.join(dir, 'gone.wav');
    const result = inspectFiles([missing]);
    expect(result.rejected).toEqual([{ path: missing, reason: 'MISSING_FILE' }]);
  });

  it('collapses duplicate paths', () => {
    const audio = path.join(dir, 'audio.ogg');
    writeFileSync(audio, 'data');
    const result = inspectFiles([audio, audio]);
    expect(result.files).toHaveLength(1);
  });

  it('rejects unsupported extensions', () => {
    const txt = path.join(dir, 'notes.txt');
    writeFileSync(txt, 'data');
    const result = inspectFiles([txt]);
    expect(result.rejected).toEqual([{ path: txt, reason: 'UNSUPPORTED_SOURCE' }]);
  });
});
