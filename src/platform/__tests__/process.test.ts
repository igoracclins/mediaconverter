import { describe, expect, it } from 'vitest';
import { createLineReader, createTailBuffer } from '../process';

describe('createLineReader', () => {
  it('buffers partial chunks and splits complete lines', () => {
    const reader = createLineReader();
    expect(reader.push('foo\nbar')).toEqual(['foo']);
    expect(reader.flush()).toEqual(['bar']);
  });

  it('handles multi-line chunks', () => {
    const reader = createLineReader();
    expect(reader.push('a\nb\nc\n')).toEqual(['a', 'b', 'c']);
    expect(reader.flush()).toEqual([]);
  });
});

describe('createTailBuffer', () => {
  it('keeps only the most recent lines', () => {
    const tail = createTailBuffer(3);
    for (let i = 1; i <= 10; i++) tail.push(`line ${i}`);
    const content = tail.content();
    expect(content.split('\n')).toEqual(['line 8', 'line 9', 'line 10']);
  });
});
