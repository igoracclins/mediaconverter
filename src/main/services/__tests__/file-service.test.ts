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
    expect(result.files[0]).toMatchObject({
      path: audio,
      extension: 'ogg',
      category: 'audio',
      sizeBytes: 4,
    });
    expect(result.rejected).toHaveLength(0);
  });

  it('discovers and distributes media files inside a directory', () => {
    writeFileSync(path.join(dir, 'audio.ogg'), 'data');
    writeFileSync(path.join(dir, 'video.mp4'), 'data');
    writeFileSync(path.join(dir, 'image.png'), 'data');
    writeFileSync(path.join(dir, 'notes.txt'), 'ignored');
    const result = inspectFiles([dir]);
    expect(result.files).toHaveLength(3);
    const categories = result.files.map((f) => f.category).sort();
    expect(categories).toEqual(['audio', 'image', 'video']);
    expect(result.rejected).toEqual([]);
  });

  it('discovers media files in nested subdirectories too', () => {
    mkdirSync(path.join(dir, 'sub'));
    mkdirSync(path.join(dir, 'sub', 'deep'));
    writeFileSync(path.join(dir, 'sub', 'a.wav'), 'data');
    writeFileSync(path.join(dir, 'sub', 'deep', 'b.mp3'), 'data');
    writeFileSync(path.join(dir, 'sub', 'deep', 'skip.bin'), 'ignored');
    const result = inspectFiles([dir]);
    const names = result.files.map((f) => f.name).sort();
    expect(names).toEqual(['a.wav', 'b.mp3']);
    expect(result.rejected).toEqual([]);
  });

  it('mixes an explicit file with a directory expansion', () => {
    writeFileSync(path.join(dir, 'music.ogg'), 'data');
    writeFileSync(path.join(dir, 'nested.mp4'), 'data');
    const result = inspectFiles([path.join(dir, 'nested.mp4'), dir]);
    expect(result.files).toHaveLength(2);
    expect(result.rejected).toEqual([]);
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
