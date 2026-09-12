import { describe, expect, it } from 'vitest';
import { buildFfmpegArgs, canStreamCopyAudio } from '../args';
import type { ConversionTask } from '../../engine';
import type { CompressionEncode } from '../../compress';

const base = {
  id: 'j1',
  inputPath: '/tmp/My Song.ogg',
  outputPath: '/tmp/My Song.mp3',
  sourceExtension: 'ogg',
  quality: 'high' as const,
  durationMs: 100_000,
};

describe('buildFfmpegArgs', () => {
  it('never introduces a shell', () => {
    const args = buildFfmpegArgs({
      ...base,
      category: 'audio',
      targetFormat: 'mp3',
    } as ConversionTask);
    expect(args.some((a) => a.includes('&&') || a.includes('|') || a.startsWith('-shell'))).toBe(
      false,
    );
  });

  it('maps audio to the right encoder and bitrate', () => {
    const strong = { ...base, category: 'audio', targetFormat: 'mp3', quality: 'low' as const };
    const args = buildFfmpegArgs(strong as ConversionTask);
    expect(args).toContain('libmp3lame');
    expect(args).toContain('128k');
    expect(args).toContain('-vn');
    expect(args).toContain('-n');
  });

  it('maps m4a to aac with faststart', () => {
    const args = buildFfmpegArgs({
      ...base,
      category: 'audio',
      targetFormat: 'm4a',
    } as ConversionTask);
    expect(args).toContain('aac');
    expect(args).toContain('+faststart');
  });

  it('maps video to libx264 with crf and yuv420p', () => {
    const task = {
      ...base,
      category: 'video' as const,
      targetFormat: 'mp4' as const,
      outputPath: '/tmp/My Song.mp4',
      quality: 'medium' as const,
    };
    const args = buildFfmpegArgs(task);
    expect(args).toContain('libx264');
    expect(args).toContain('23');
    expect(args).toContain('yuv420p');
    expect(args).toContain('+faststart');
  });

  it('places output-mapped options after the input url', () => {
    const args = buildFfmpegArgs({
      ...base,
      category: 'audio',
      targetFormat: 'mp3',
    } as ConversionTask);
    const inputIndex = args.indexOf('-i');
    expect(inputIndex).toBeGreaterThan(-1);
    for (const opt of ['-map_metadata', '-n', '-vn']) {
      expect(args.indexOf(opt)).toBeGreaterThan(inputIndex);
    }
  });

  it('places input flags before definitional map_metadata for video', () => {
    const args = buildFfmpegArgs({
      ...base,
      category: 'video',
      targetFormat: 'webm',
    } as ConversionTask);
    expect(args.indexOf('-i')).toBeLessThan(args.indexOf('-map_metadata'));
    expect(args.indexOf('-map_metadata')).toBeLessThan(args.indexOf('libvpx-vp9'));
  });

  it('maps webm to vp9 + opus', () => {
    const args = buildFfmpegArgs({
      ...base,
      category: 'video',
      targetFormat: 'webm',
    } as ConversionTask);
    expect(args).toContain('libvpx-vp9');
    expect(args).toContain('libopus');
  });
});

describe('buildFfmpegArgs (extraction)', () => {
  const withExtraction = (
    targetFormat: string,
    streamCopy: boolean,
    outputPath = '/tmp/My Song.mp3',
  ): ConversionTask =>
    ({
      ...base,
      category: 'audio',
      targetFormat,
      outputPath,
      extraction: { streamCopy },
    }) as unknown as ConversionTask;

  it('stream-copies the audio track without touching video', () => {
    const args = buildFfmpegArgs(withExtraction('m4a', true, '/tmp/My Song.m4a'));
    expect(args).toContain('-vn');
    expect(args).toContain('-sn');
    expect(args).toContain('-c:a');
    expect(args).toContain('copy');
    expect(args).toContain('-n');
    expect(args).not.toContain('aac');
    expect(args).not.toContain('256k');
  });

  it('re-encodes audio with the high profile when copy is not possible', () => {
    const args = buildFfmpegArgs(withExtraction('mp3', false));
    expect(args).toContain('-vn');
    expect(args).toContain('-c:a');
    expect(args).toContain('libmp3lame');
    expect(args).toContain('320k');
    expect(args).not.toContain('copy');
  });

  it('re-encodes m4a with aac + faststart when copy is not possible', () => {
    const args = buildFfmpegArgs(withExtraction('m4a', false, '/tmp/My Song.m4a'));
    expect(args).toContain('aac');
    expect(args).toContain('256k');
    expect(args).toContain('+faststart');
  });

  it('places output flags after the input url', () => {
    const args = buildFfmpegArgs(withExtraction('mp3', false));
    const inputIndex = args.indexOf('-i');
    for (const opt of ['-map_metadata', '-n', '-vn']) {
      expect(args.indexOf(opt)).toBeGreaterThan(inputIndex);
    }
  });
});

describe('canStreamCopyAudio', () => {
  it('allows compatible codec/container pairs', () => {
    expect(canStreamCopyAudio('m4a', 'aac')).toBe(true);
    expect(canStreamCopyAudio('m4a', 'alac')).toBe(true);
    expect(canStreamCopyAudio('mp3', 'mp3')).toBe(true);
    expect(canStreamCopyAudio('ogg', 'opus')).toBe(true);
    expect(canStreamCopyAudio('ogg', 'vorbis')).toBe(true);
    expect(canStreamCopyAudio('wav', 'pcm_s16le')).toBe(true);
    expect(canStreamCopyAudio('flac', 'flac')).toBe(true);
  });

  it('rejects incompatible or unknown codecs', () => {
    expect(canStreamCopyAudio('m4a', 'mp3')).toBe(false);
    expect(canStreamCopyAudio('m4a', null)).toBe(false);
    expect(canStreamCopyAudio('ogg', 'aac')).toBe(false);
    expect(canStreamCopyAudio('mp3', 'aac')).toBe(false);
    expect(canStreamCopyAudio('wav', 'aac')).toBe(false);
    expect(canStreamCopyAudio('mp3', 'not-a-codec')).toBe(false);
  });
});

describe('buildFfmpegArgs (compression)', () => {
  const withCompression = (
    task: Record<string, unknown>,
    encode: CompressionEncode,
  ): ConversionTask =>
    ({
      ...task,
      compression: { targetSizeMb: 30, preset: 'balanced', encode },
    }) as unknown as ConversionTask;

  it('targets a fixed audio bitrate for mp3, without the quality tag', () => {
    const args = buildFfmpegArgs(
      withCompression(
        { ...base, category: 'audio', targetFormat: 'mp3' },
        { kind: 'audio', audioBitrateBps: 128_000 },
      ),
    );
    expect(args).toContain('libmp3lame');
    expect(args).toContain('-b:a');
    expect(args).toContain('128k');
    expect(args).toContain('-vn');
    expect(args.filter((a) => a === '128k')).toHaveLength(1);
    expect(args).not.toContain('192k');
    expect(args).not.toContain('320k');
    expect(args).not.toContain('+faststart');
  });

  it('adds faststart for compressed m4a', () => {
    const args = buildFfmpegArgs(
      withCompression(
        { ...base, category: 'audio', targetFormat: 'm4a' },
        { kind: 'audio', audioBitrateBps: 96_000 },
      ),
    );
    expect(args).toContain('aac');
    expect(args).toContain('96k');
    expect(args).toContain('+faststart');
  });

  it('maps compressed ogg to a vorbis quality level', () => {
    const args = buildFfmpegArgs(
      withCompression(
        { ...base, category: 'audio', targetFormat: 'ogg' },
        { kind: 'audio-vorbis', quality: 4 },
      ),
    );
    expect(args).toContain('libvorbis');
    expect(args).toContain('-q:a');
    expect(args).toContain('4');
  });

  it('uses ABR with rate buffers for balanced/max video', () => {
    const args = buildFfmpegArgs(
      withCompression(
        { ...base, category: 'video', targetFormat: 'mp4', outputPath: '/tmp/x.mp4' },
        { kind: 'video-abr', videoBitrateBps: 1_200_000, audioBitrateBps: 128_000 },
      ),
    );
    expect(args).toContain('libx264');
    expect(args).toContain('-b:v');
    expect(args).toContain('1200k');
    expect(args).toContain('-maxrate');
    expect(args).toContain('2400k');
    expect(args).toContain('-b:a');
    expect(args).toContain('128k');
    expect(args).toContain('yuv420p');
    expect(args).toContain('+faststart');
    expect(args).not.toContain('-crf');
  });

  it('uses CRF (no target bitrate) for the good video profile', () => {
    const args = buildFfmpegArgs(
      withCompression(
        { ...base, category: 'video', targetFormat: 'mp4', outputPath: '/tmp/x.mp4' },
        { kind: 'video-crf', crf: 18, audioBitrateBps: 192_000 },
      ),
    );
    expect(args).toContain('libx264');
    expect(args).toContain('-crf');
    expect(args).toContain('18');
    expect(args).toContain('-b:a');
    expect(args).toContain('192k');
    expect(args).toContain('+faststart');
    expect(args).not.toContain('-b:v');
  });

  it('compresses webm with vp9 ABR + opus', () => {
    const args = buildFfmpegArgs(
      withCompression(
        { ...base, category: 'video', targetFormat: 'webm', outputPath: '/tmp/x.webm' },
        { kind: 'video-abr', videoBitrateBps: 800_000, audioBitrateBps: 96_000 },
      ),
    );
    expect(args).toContain('libvpx-vp9');
    expect(args).toContain('-b:v');
    expect(args).toContain('800k');
    expect(args).toContain('libopus');
    expect(args).toContain('96k');
    expect(args).not.toContain('+faststart');
  });

  it('falls back to the standard profile for lossless/unknown plans', () => {
    const wavArgs = buildFfmpegArgs(
      withCompression({ ...base, category: 'audio', targetFormat: 'wav' }, { kind: 'lossless' }),
    );
    expect(wavArgs).toContain('pcm_s16le');

    const noneArgs = buildFfmpegArgs(
      withCompression({ ...base, category: 'audio', targetFormat: 'mp3' }, { kind: 'none' }),
    );
    expect(noneArgs).toContain('libmp3lame');
    expect(noneArgs).toContain('320k');
  });
});
