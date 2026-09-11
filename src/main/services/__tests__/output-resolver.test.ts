import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolveAndReserveOutput, validateInput } from '../output-resolver';

describe('resolveAndReserveOutput', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-out-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses a Convertidos folder next to the input when no destination is given', () => {
    const input = path.join(dir, 'audio.ogg');
    const result = resolveAndReserveOutput(input, 'mp3', null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outputPath).toBe(path.join(dir, 'Convertidos', 'audio.mp3'));
      expect(path.dirname(result.outputPath)).toBe(path.join(dir, 'Convertidos'));
    }
  });

  it('uses a Comprimidos folder when resolving a compression output', () => {
    const input = path.join(dir, 'audio.ogg');
    const result = resolveAndReserveOutput(input, 'mp3', null, 'Comprimidos');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outputPath).toBe(path.join(dir, 'Comprimidos', 'audio.mp3'));
  });

  it('resolves a fresh name when the destination already exists (collision)', () => {
    const input = path.join(dir, 'audio.ogg');
    const convDir = path.join(dir, 'Convertidos');
    mkdirSync(convDir, { recursive: true });
    writeFileSync(path.join(convDir, 'audio.mp3'), 'x');
    const result = resolveAndReserveOutput(input, 'mp3', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outputPath).toBe(path.join(dir, 'Convertidos', 'audio (1).mp3'));
  });

  it('increments again when the first collision suffix is also taken', () => {
    const input = path.join(dir, 'audio.ogg');
    const convDir = path.join(dir, 'Convertidos');
    mkdirSync(convDir, { recursive: true });
    writeFileSync(path.join(convDir, 'audio.mp3'), 'x');
    writeFileSync(path.join(convDir, 'audio (1).mp3'), 'x');
    const result = resolveAndReserveOutput(input, 'mp3', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outputPath).toBe(path.join(dir, 'Convertidos', 'audio (2).mp3'));
  });

  it('creates a missing destination directory recursively', () => {
    const input = path.join(dir, 'audio.ogg');
    const dest = path.join(dir, 'deep', 'nested');
    const result = resolveAndReserveOutput(input, 'mp3', dest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(path.dirname(result.outputPath)).toBe(dest);
  });

  it('rejects when the destination path is an existing file', () => {
    const input = path.join(dir, 'audio.ogg');
    const destFile = path.join(dir, 'afile');
    writeFileSync(destFile, 'x');
    const result = resolveAndReserveOutput(input, 'mp3', destFile);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_PATH');
  });

  it('gives files in different directories their own Convertidos folder', () => {
    const aDir = path.join(dir, 'a');
    const bDir = path.join(dir, 'b');
    const resultA = resolveAndReserveOutput(path.join(aDir, 'one.wav'), 'mp3', null);
    const resultB = resolveAndReserveOutput(path.join(bDir, 'two.wav'), 'mp3', null);
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.outputPath).toBe(path.join(aDir, 'Convertidos', 'one.mp3'));
      expect(resultB.outputPath).toBe(path.join(bDir, 'Convertidos', 'two.mp3'));
      expect(path.dirname(resultA.outputPath)).not.toBe(path.dirname(resultB.outputPath));
    }
  });

  it('reports NO_WRITE_PERMISSION when the destination cannot be created', () => {
    const input = path.join(dir, 'audio.ogg');
    const result = resolveAndReserveOutput(input, 'mp3', '/proc/nonexistent');
    if (result.ok) return; // tolerate platforms where creation unexpectedly succeeds
    expect(result.error).toBe('NO_WRITE_PERMISSION');
  });
});

describe('validateInput', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-in-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a missing input file', () => {
    const result = validateInput(path.join(dir, 'nope.wav'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('MISSING_FILE');
  });

  it('accepts an existing input file', () => {
    const input = path.join(dir, 'ok.wav');
    writeFileSync(input, 'data');
    expect(validateInput(input).ok).toBe(true);
  });
});
