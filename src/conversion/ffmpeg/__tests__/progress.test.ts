import { describe, expect, it } from 'vitest';
import { computeProgress, parseProgressChunk, parseProgressLine } from '../progress';

describe('parseProgressLine', () => {
  it('parses key=value pairs', () => {
    expect(parseProgressLine('out_time_us=123456')).toEqual({ out_time_us: '123456' });
    expect(parseProgressLine('progress=end')).toEqual({ progress: 'end' });
    expect(parseProgressLine('')).toEqual({});
    expect(parseProgressLine('noequals')).toEqual({});
  });
});

describe('parseProgressChunk', () => {
  it('extracts timestamps and the end marker', () => {
    const sample = parseProgressChunk(
      'frame=123\nout_time_us=500000\nout_time_ms=500\nprogress=continue',
    );
    expect(sample.outTimeUs).toBe(500000);
    expect(sample.frame).toBe(123);
    expect(sample.finished).toBe(false);
    expect(parseProgressChunk('progress=end').finished).toBe(true);
  });

  it('treats N/A as unknown', () => {
    const sample = parseProgressChunk('out_time_us=N/A');
    expect(sample.outTimeUs).toBeNull();
  });
});

describe('computeProgress', () => {
  it('maps elapsed microseconds to 0..100', () => {
    expect(computeProgress(500_000, 1_000)).toBe(50);
    expect(computeProgress(0, 1_000)).toBe(0);
    expect(computeProgress(2_000_000, 1_000)).toBe(100);
  });

  it('returns null without a duration', () => {
    expect(computeProgress(500_000, null)).toBeNull();
  });
});
