import { describe, expect, it } from 'vitest';
import {
  minimumAllowedMb,
  maxSizeValidation,
  originalSizeMb,
  parseMaxInput,
  sanitizeSizeInput,
  formatMb,
} from '../compression-ui';

describe('originalSizeMb', () => {
  it('returns null for missing or zero sizes', () => {
    expect(originalSizeMb(0)).toBeNull();
    expect(originalSizeMb(-1)).toBeNull();
    expect(originalSizeMb(NaN)).toBeNull();
  });

  it('converts bytes to MB', () => {
    expect(originalSizeMb(1048576)).toBe(1);
    expect(originalSizeMb(5242880)).toBe(5);
  });
});

describe('sanitizeSizeInput', () => {
  it('keeps digits and the first decimal separator', () => {
    expect(sanitizeSizeInput('12a .,3,4')).toBe('12.34');
  });

  it('preserves a comma as the typed separator', () => {
    expect(sanitizeSizeInput('12,34')).toBe('12,34');
  });

  it('strips letters, spaces, symbols and extra separators', () => {
    expect(sanitizeSizeInput('ab 30..5z')).toBe('30.5');
    expect(sanitizeSizeInput('-10+')).toBe('10');
  });

  it('drops negative signs', () => {
    expect(sanitizeSizeInput('-30')).toBe('30');
  });
});

describe('parseMaxInput', () => {
  it('parses whole and decimal values', () => {
    expect(parseMaxInput('30')).toBe(30);
    expect(parseMaxInput('30,5')).toBe(30.5);
    expect(parseMaxInput('30.5')).toBe(30.5);
    expect(parseMaxInput('.5')).toBe(0.5);
  });

  it('parses zero as a zero limit', () => {
    expect(parseMaxInput('0')).toBe(0);
    expect(parseMaxInput('0,00')).toBe(0);
  });

  it('rejects empty or malformed values', () => {
    expect(parseMaxInput('')).toBeNull();
    expect(parseMaxInput('   ')).toBeNull();
    expect(parseMaxInput('abc')).toBeNull();
    expect(parseMaxInput('1.2.3')).toBeNull();
    expect(parseMaxInput('1e3')).toBeNull();
    expect(parseMaxInput('.')).toBeNull();
  });
});

describe('minimumAllowedMb', () => {
  it('is 5% of the original size', () => {
    expect(minimumAllowedMb(104857600)).toBe(5);
    expect(minimumAllowedMb(20971520)).toBe(1);
  });

  it('never goes below 0.10 MB', () => {
    expect(minimumAllowedMb(1048576)).toBe(0.1);
    expect(minimumAllowedMb(512000)).toBe(0.1);
  });
});

describe('formatMb', () => {
  it('always displays two decimal places', () => {
    expect(formatMb(5)).toBe('5.00 MB');
    expect(formatMb(0.1)).toBe('0.10 MB');
    expect(formatMb(30.456)).toBe('30.46 MB');
  });
});

describe('maxSizeValidation', () => {
  const sizeBytes = 104857600; // 100 MB

  it('accepts a limit below the original and above the floor', () => {
    const v = maxSizeValidation('30', sizeBytes);
    expect(v.ok).toBe(true);
    expect(v.maxMb).toBe(30);
    expect(v.issue).toBeNull();
  });

  it('treats empty and zero as not configured', () => {
    expect(maxSizeValidation('', sizeBytes).issue).toBe('empty');
    expect(maxSizeValidation('0', sizeBytes).issue).toBe('empty');
    expect(maxSizeValidation('0', sizeBytes).ok).toBe(false);
  });

  it('rejects a limit equal to or above the original size', () => {
    expect(maxSizeValidation('100', sizeBytes).issue).toBe('not-below-original');
    expect(maxSizeValidation('150', sizeBytes).issue).toBe('not-below-original');
  });

  it('rejects a limit below the 5% floor', () => {
    expect(maxSizeValidation('0.5', sizeBytes).issue).toBe('below-minimum');
    expect(maxSizeValidation('4.9', sizeBytes).issue).toBe('below-minimum');
  });

  it('accepts a comma decimal separator', () => {
    const v = maxSizeValidation('30,5', sizeBytes);
    expect(v.ok).toBe(true);
    expect(v.maxMb).toBe(30.5);
  });

  it('flags a small file whose floor exceeds the original size', () => {
    const tiny = 102400; // ~0.1 MB: floor 0.10 MB is not below the original
    expect(maxSizeValidation('0.05', tiny).issue).toBe('below-minimum');
  });
});