import { describe, expect, it } from 'vitest';
import { suggestImageTarget, suggestTarget } from '../suggest';

describe('suggestTarget', () => {
  it('maps categories to sensible defaults', () => {
    expect(suggestTarget('audio')).toBe('mp3');
    expect(suggestTarget('video')).toBe('mp4');
    expect(suggestTarget('image')).toBe('webp');
  });
});

describe('suggestImageTarget', () => {
  it('prefers lossy targets for photos', () => {
    expect(suggestImageTarget('tif')).toBe('jpg');
    expect(suggestImageTarget('avif')).toBe('jpg');
  });

  it('keeps lossless sources near their intent', () => {
    expect(suggestImageTarget('bmp')).toBe('png');
  });

  it('defaults to webp', () => {
    expect(suggestImageTarget('gif')).toBe('webp');
  });
});
