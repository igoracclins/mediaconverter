import { describe, expect, it } from 'vitest';
import {
  nextAvailableName,
  normalizeDirectory,
  resolveOutputPath,
  sanitizeBaseName,
  targetFileName,
} from '../filenames';

describe('sanitizeBaseName', () => {
  it('strips illegal characters and trims', () => {
    expect(sanitizeBaseName('a<b>:"c')).toBe('abc');
    expect(sanitizeBaseName('  name  ')).toBe('name');
    expect(sanitizeBaseName('trailing. ')).toBe('trailing');
  });

  it('handles reserved Windows names', () => {
    expect(sanitizeBaseName('CON')).toBe('_CON');
    expect(sanitizeBaseName('nul.txt')).toBe('_nul.txt');
  });

  it('falls back to "output"', () => {
    expect(sanitizeBaseName('')).toBe('output');
    expect(sanitizeBaseName('***')).toBe('output');
  });
});

describe('targetFileName', () => {
  it('replaces the extension', () => {
    expect(targetFileName('audio.ogg', 'mp3')).toBe('audio.mp3');
    expect(targetFileName('a.b.c.m4a', 'mp3')).toBe('a.b.c.mp3');
  });

  it('normalises the target extension', () => {
    expect(targetFileName('song.wav', '.MP3')).toBe('song.mp3');
  });
});

describe('nextAvailableName', () => {
  it('returns the plain name first', () => {
    expect(nextAvailableName('audio', 'mp3', new Set())).toBe('audio.mp3');
  });

  it('increments on collision', () => {
    const existing = new Set(['audio.mp3']);
    expect(nextAvailableName('audio', 'mp3', existing)).toBe('audio (1).mp3');
    expect(nextAvailableName('audio', 'mp3', new Set(['audio.mp3', 'audio (1).mp3']))).toBe(
      'audio (2).mp3',
    );
  });
});

describe('resolveOutputPath', () => {
  it('uses a Convertidos folder next to the input when dest is null', () => {
    expect(resolveOutputPath('/mnt/media/audio.ogg', 'mp3', null)).toBe(
      '/mnt/media/Convertidos/audio.mp3',
    );
    expect(resolveOutputPath('C:\\media\\clip.mov', 'mp4', null)).toBe(
      'C:/media/Convertidos/clip.mp4',
    );
  });

  it('uses the given destination directory', () => {
    expect(resolveOutputPath('/mnt/media/audio.ogg', 'mp3', '/out')).toBe('/out/audio.mp3');
  });

  it('normalises trailing separators in destination', () => {
    expect(normalizeDirectory('/out//')).toBe('/out');
    expect(normalizeDirectory('C:\\out\\')).toBe('C:/out');
  });
});
