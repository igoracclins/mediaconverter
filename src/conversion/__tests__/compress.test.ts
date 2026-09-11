import { describe, expect, it } from 'vitest';
import {
  MB_BITS,
  bitsToKbps,
  bitsToMb,
  bytesToMb,
  clampSizeMbToFile,
  evaluateCompression,
  isValidCompressionOptions,
  mbToBits,
  parseTargetSizeMb,
  type CompressionEvaluationInput,
} from '../compress';

function base(overrides: Partial<CompressionEvaluationInput>): CompressionEvaluationInput {
  return {
    category: 'audio',
    targetFormat: 'mp3' as const,
    maxSizeMb: 30,
    sizeBytes: 10_485_760,
    durationMs: 120_000,
    hasVideo: false,
    hasAudio: true,
    ...overrides,
  };
}

describe('size conversion helpers', () => {
  it('converts MB to bits and back', () => {
    expect(mbToBits(1)).toBe(MB_BITS);
    expect(mbToBits(30)).toBe(30 * MB_BITS);
    expect(bitsToMb(mbToBits(5))).toBeCloseTo(5);
    expect(bitsToKbps(1_200_000)).toBe(1200);
    expect(bitsToKbps(0)).toBe(1);
  });

  it('converts bytes to MB', () => {
    expect(bytesToMb(1048576)).toBe(1);
    expect(bytesToMb(5242880)).toBe(5);
  });

  it('clamps the max size to the original file size', () => {
    expect(clampSizeMbToFile(100, 50 * 1048576)).toBe(50);
    expect(clampSizeMbToFile(30, 50 * 1048576)).toBe(30);
    expect(clampSizeMbToFile(30, 0)).toBe(30);
    expect(clampSizeMbToFile(30, -1)).toBe(30);
  });

  it('parses user-provided sizes, rejecting invalid values', () => {
    expect(parseTargetSizeMb('30')).toBe(30);
    expect(parseTargetSizeMb('0.5')).toBe(0.5);
    expect(parseTargetSizeMb(20)).toBe(20);
    expect(parseTargetSizeMb('0')).toBeNull();
    expect(parseTargetSizeMb('-4')).toBeNull();
    expect(parseTargetSizeMb('abc')).toBeNull();
    expect(parseTargetSizeMb('')).toBeNull();
    expect(parseTargetSizeMb('   ')).toBeNull();
    expect(parseTargetSizeMb(Number.NaN)).toBeNull();
    expect(parseTargetSizeMb(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseTargetSizeMb(null)).toBeNull();
    expect(parseTargetSizeMb(undefined)).toBeNull();
  });

  it('validates compression option payloads (maxSizeMb only)', () => {
    expect(isValidCompressionOptions({ maxSizeMb: 30 })).toBe(true);
    expect(isValidCompressionOptions({ maxSizeMb: 0.5 })).toBe(true);
    expect(isValidCompressionOptions({ maxSizeMb: 0 })).toBe(false);
    expect(isValidCompressionOptions({ maxSizeMb: -1 })).toBe(false);
    expect(isValidCompressionOptions(30)).toBe(false);
    expect(isValidCompressionOptions(null)).toBe(false);
    expect(isValidCompressionOptions({ maxSizeMb: 'bad' })).toBe(false);
  });
});

describe('audio compression estimates', () => {
  it('reports ok when the budget exceeds the recommended minimum', () => {
    const { estimate, encode } = evaluateCompression(base({ maxSizeMb: 50 }));
    expect(estimate.status).toBe('ok');
    expect(encode).toEqual({ kind: 'audio', audioBitrateBps: 320_000 });
  });

  it('handles short durations (bitrate blows past the ceiling, still ok)', () => {
    const { estimate, encode } = evaluateCompression(base({ durationMs: 30_000 }));
    expect(estimate.status).toBe('ok');
    expect(encode.kind === 'audio' && encode.audioBitrateBps === 320_000).toBe(true);
  });

  it('reports aggressive when the budget is between hard floor and recommended', () => {
    const { estimate } = evaluateCompression(base({ maxSizeMb: 40, durationMs: 3_600_000 }));
    expect(estimate.status).toBe('aggressive');
    expect(estimate.recommendedMinMb).toBeGreaterThan(40);
    expect(estimate.hardMinMb).toBeLessThan(40);
  });

  it('flags budgets below the hard floor as impossible', () => {
    const { estimate } = evaluateCompression(base({ maxSizeMb: 1, durationMs: 3_600_000 }));
    expect(estimate.status).toBe('impossible');
    expect(estimate.recommendedMinMb!).toBeGreaterThan(1);
  });

  it('maps ogg to a vorbis quality level in range', () => {
    const { estimate, encode } = evaluateCompression(
      base({ targetFormat: 'ogg', maxSizeMb: 50, durationMs: 300_000 }),
    );
    expect(estimate.status).toBe('ok');
    if (encode.kind !== 'audio-vorbis') throw new Error('expected vorbis encode');
    expect(encode.quality).toBeGreaterThanOrEqual(2);
    expect(encode.quality).toBeLessThanOrEqual(10);
  });

  it('treats lossless audio targets as unsupported for size targeting', () => {
    for (const targetFormat of ['wav', 'flac'] as const) {
      const { estimate, encode } = evaluateCompression(base({ targetFormat }));
      expect(estimate.status).toBe('unsupported');
      expect(estimate.unsupportedReason).toBe('lossless-target');
      expect(encode).toEqual({ kind: 'lossless' });
    }
  });

  it('returns a no-duration unsupported plan when duration is unknown', () => {
    const { estimate, encode } = evaluateCompression(base({ durationMs: null }));
    expect(estimate.status).toBe('unsupported');
    expect(estimate.unsupportedReason).toBe('no-duration');
    expect(encode).toEqual({ kind: 'none' });
  });
});

describe('video compression estimates', () => {
  const video = (overrides: Partial<CompressionEvaluationInput> = {}): CompressionEvaluationInput =>
    base({ category: 'video', targetFormat: 'mp4', hasVideo: true, hasAudio: true, ...overrides });

  it('reports aggressive when budget is below recommended for a 5min video', () => {
    const { estimate, encode } = evaluateCompression(video({ maxSizeMb: 20, durationMs: 300_000 }));
    expect(estimate.status).toBe('aggressive');
    if (encode.kind !== 'video-abr') throw new Error('expected abr encode');
    expect(encode.audioBitrateBps).toBe(128_000);
  });

  it('reports ok when budget is generous for a 5min video', () => {
    const { estimate, encode } = evaluateCompression(
      video({ maxSizeMb: 100, durationMs: 300_000 }),
    );
    expect(estimate.status).toBe('ok');
    if (encode.kind !== 'video-abr') throw new Error('expected abr encode');
    expect(encode.videoBitrateBps).toBeGreaterThan(1_200_000);
    expect(encode.videoBitrateBps).toBeLessThanOrEqual(15_000_000);
    expect(encode.audioBitrateBps).toBe(128_000);
  });

  it('does not reserve audio bitrate when the source has no audio stream', () => {
    const { encode } = evaluateCompression(video({ hasAudio: false, durationMs: 300_000 }));
    if (encode.kind !== 'video-abr') throw new Error('expected abr encode');
    expect(encode.audioBitrateBps).toBe(0);
  });

  it('returns a no-duration unsupported plan when duration is unknown', () => {
    const { estimate, encode } = evaluateCompression(video({ durationMs: null }));
    expect(estimate.status).toBe('unsupported');
    expect(estimate.unsupportedReason).toBe('no-duration');
    expect(encode).toEqual({ kind: 'none' });
  });

  it('differentiates a short vs. a long video of the same size', () => {
    const short = evaluateCompression(
      video({ sizeBytes: (100 * MB_BITS) / 8, durationMs: 10_000 }),
    ).estimate;
    const long = evaluateCompression(
      video({ sizeBytes: (100 * MB_BITS) / 8, durationMs: 1_800_000 }),
    ).estimate;
    expect(short.status).toBe('ok');
    expect(long.status).toBe('impossible');
  });
});

describe('image compression estimates', () => {
  const image = (overrides: Partial<CompressionEvaluationInput> = {}): CompressionEvaluationInput =>
    base({ category: 'image', targetFormat: 'jpg', sizeBytes: 5_242_880, ...overrides });

  it('maps target ratio to a quality level and reports ok within bounds', () => {
    const { estimate, encode } = evaluateCompression(image({ maxSizeMb: 1 }));
    expect(estimate.currentSizeMb).toBe(5);
    expect(estimate.status).toBe('ok');
    if (encode.kind !== 'image') throw new Error('expected image encode');
    expect(encode.quality).toBeGreaterThanOrEqual(30);
    expect(encode.quality).toBeLessThanOrEqual(60);
  });

  it('flags aggressive targets and clamps quality to a floor', () => {
    const { estimate, encode } = evaluateCompression(image({ maxSizeMb: 0.5 }));
    expect(estimate.status).toBe('aggressive');
    expect(encode.kind === 'image' && encode.quality).toBeLessThanOrEqual(35);
  });

  it('treats unreachable targets as impossible', () => {
    const { estimate, encode } = evaluateCompression(image({ maxSizeMb: 0.2 }));
    expect(estimate.status).toBe('impossible');
    if (encode.kind !== 'image') throw new Error('expected image encode');
    expect(encode.quality).toBe(25);
  });

  it('keeps near-original quality when the target is at or above the source size', () => {
    const { estimate, encode } = evaluateCompression(image({ maxSizeMb: 30 }));
    expect(estimate.status).toBe('ok');
    if (encode.kind !== 'image') throw new Error('expected image encode');
    expect(encode.quality).toBe(95);
  });

  it('treats png (lossless) as unsupported for size targeting', () => {
    const { estimate, encode } = evaluateCompression(image({ targetFormat: 'png' }));
    expect(estimate.status).toBe('unsupported');
    expect(estimate.unsupportedReason).toBe('lossless-target');
    expect(encode).toEqual({ kind: 'lossless' });
  });
});
