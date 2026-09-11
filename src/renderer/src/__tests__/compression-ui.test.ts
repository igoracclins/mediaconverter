import { describe, expect, it } from 'vitest';
import { initialSizeMb, originalSizeMb } from '../compression-ui';

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

describe('initialSizeMb', () => {
  it('adds a 100MB safety margin to the recommendation', () => {
    expect(
      initialSizeMb({ sizeBytes: 524288000, recommendedMinMb: 2.861, hardMinMb: 0.596 }),
    ).toBe(102.86);
  });

  it('never exceeds the original size for small files', () => {
    const seed = initialSizeMb({ sizeBytes: 129639, recommendedMinMb: 2.861, hardMinMb: 0.596 });
    expect(seed).not.toBeNull();
    expect(seed!).toBeLessThanOrEqual(originalSizeMb(129639)!);
    expect(seed).toBe(0.12);
  });

  it('caps the margin at the original size', () => {
    expect(
      initialSizeMb({ sizeBytes: 104857600, recommendedMinMb: 13.4, hardMinMb: 8 }),
    ).toBe(100);
  });

  it('keeps the seed within the hard minimum when the original allows', () => {
    const seed = initialSizeMb({ sizeBytes: 314572800, recommendedMinMb: null, hardMinMb: 50 });
    expect(seed).toBe(150);
    expect(seed!).toBeGreaterThanOrEqual(50);
  });

  it('returns null when there is nothing to recommend', () => {
    expect(
      initialSizeMb({ sizeBytes: 1048576, recommendedMinMb: null, hardMinMb: null }),
    ).toBeNull();
  });
});