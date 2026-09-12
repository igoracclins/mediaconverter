import type { AudioTargetFormat, QualityPreset, VideoTargetFormat } from '@shared/types';
import type { ConversionTask } from '../engine';
import { bitsToKbps, type CompressionEncode } from '../compress';

export interface AudioProfile {
  codec: string;
  args: string[];
}

const EXTRACT_COPY_CODECS: Record<AudioTargetFormat, readonly string[]> = {
  mp3: ['mp3', 'mp2', 'mp1'],
  m4a: ['aac', 'alac'],
  wav: [
    'pcm_u8',
    'pcm_s16le',
    'pcm_s24le',
    'pcm_s32le',
    'pcm_f32le',
    'pcm_f64le',
    'pcm_mulaw',
    'pcm_alaw',
    'pcm_s16be',
    'pcm_s24be',
    'pcm_s32be',
    'pcm_f32be',
    'pcm_f64be',
  ],
  ogg: ['vorbis', 'opus'],
  flac: ['flac'],
};

export function canStreamCopyAudio(target: AudioTargetFormat, codecName: string | null): boolean {
  if (!codecName) return false;
  return EXTRACT_COPY_CODECS[target].includes(codecName.toLowerCase());
}

const AUDIO_BITRATES: Record<AudioTargetFormat, Record<QualityPreset, string>> = {
  mp3: { high: '320k', medium: '192k', low: '128k' },
  m4a: { high: '256k', medium: '160k', low: '96k' },
  wav: { high: '', medium: '', low: '' },
  ogg: { high: '', medium: '', low: '' },
  flac: { high: '', medium: '', low: '' },
};

function audioProfile(target: AudioTargetFormat, quality: QualityPreset): AudioProfile {
  switch (target) {
    case 'mp3':
      return { codec: 'libmp3lame', args: ['-b:a', AUDIO_BITRATES.mp3[quality]] };
    case 'm4a':
      return {
        codec: 'aac',
        args: ['-b:a', AUDIO_BITRATES.m4a[quality], '-movflags', '+faststart'],
      };
    case 'wav':
      return { codec: 'pcm_s16le', args: ['-ar', '48000'] };
    case 'ogg': {
      const q = quality === 'high' ? '6' : quality === 'medium' ? '4' : '2';
      return { codec: 'libvorbis', args: ['-q:a', q] };
    }
    case 'flac':
      return { codec: 'flac', args: [] };
  }
}

export interface VideoProfile {
  videoArgs: string[];
  audioArgs: string[];
}

function videoProfile(target: VideoTargetFormat, quality: QualityPreset): VideoProfile {
  const crf = { high: '18', medium: '23', low: '28' }[quality];
  const webmCrf = { high: '30', medium: '34', low: '40' }[quality];
  switch (target) {
    case 'webm':
      return {
        videoArgs: ['-c:v', 'libvpx-vp9', '-crf', webmCrf, '-b:v', '0', '-row-mt', '1'],
        audioArgs: ['-c:a', 'libopus', '-b:a', '128k'],
      };
    case 'mp4':
    case 'mov':
      return {
        videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p'],
        audioArgs: ['-c:a', 'aac', '-b:a', '192k'],
      };
    case 'mkv':
      return {
        videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p'],
        audioArgs: ['-c:a', 'aac', '-b:a', '192k'],
      };
  }
}

function compressionAudioArgs(target: AudioTargetFormat, enc: CompressionEncode): string[] {
  if (enc.kind === 'audio-vorbis') {
    return ['-vn', '-sn', '-c:a', 'libvorbis', '-q:a', String(enc.quality)];
  }
  if (enc.kind === 'audio') {
    const codec = target === 'mp3' ? 'libmp3lame' : 'aac';
    const args = ['-vn', '-sn', '-c:a', codec, '-b:a', `${bitsToKbps(enc.audioBitrateBps)}k`];
    if (target === 'm4a') args.push('-movflags', '+faststart');
    return args;
  }
  const profile = audioProfile(target, 'high');
  return ['-vn', '-sn', '-c:a', profile.codec, ...profile.args];
}

function compressionVideoArgs(target: VideoTargetFormat, enc: CompressionEncode): string[] {
  const isWebm = target === 'webm';
  const faststart = target === 'mp4' || target === 'mov' ? ['-movflags', '+faststart'] : [];

  if (enc.kind === 'video-crf') {
    const audio = [
      '-c:a',
      isWebm ? 'libopus' : 'aac',
      '-b:a',
      `${bitsToKbps(enc.audioBitrateBps)}k`,
    ];
    const video = isWebm
      ? ['-c:v', 'libvpx-vp9', '-crf', String(enc.crf), '-b:v', '0', '-row-mt', '1']
      : ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(enc.crf), '-pix_fmt', 'yuv420p'];
    return ['-sn', ...video, ...audio, ...faststart];
  }

  if (enc.kind === 'video-abr') {
    const audio = [
      '-c:a',
      isWebm ? 'libopus' : 'aac',
      '-b:a',
      `${bitsToKbps(enc.audioBitrateBps)}k`,
    ];
    const kb = bitsToKbps(enc.videoBitrateBps);
    const video = isWebm
      ? ['-c:v', 'libvpx-vp9', '-b:v', `${kb}k`, '-row-mt', '1']
      : [
          '-c:v',
          'libx264',
          '-preset',
          'medium',
          '-b:v',
          `${kb}k`,
          '-maxrate',
          `${kb}k`,
          '-bufsize',
          `${Math.max(1, Math.round(kb * 2))}k`,
          '-pix_fmt',
          'yuv420p',
        ];
    return ['-sn', ...video, ...audio, ...faststart];
  }

  const profile = videoProfile(target, 'high');
  return ['-sn', ...profile.videoArgs, ...profile.audioArgs];
}

export function buildFfmpegArgs(task: ConversionTask): string[] {
  const base = ['-hide_banner', '-nostdin', '-nostats', '-progress', 'pipe:1'];

  const encode = task.compression?.encode;
  if (encode && encode.kind !== 'none' && encode.kind !== 'lossless') {
    const codecArgs =
      task.category === 'audio'
        ? compressionAudioArgs(task.targetFormat as AudioTargetFormat, encode)
        : compressionVideoArgs(task.targetFormat as VideoTargetFormat, encode);
    return [
      ...base,
      '-i',
      task.inputPath,
      '-map_metadata',
      '0',
      '-n',
      ...codecArgs,
      task.outputPath,
    ];
  }

  if (task.extraction) {
    if (task.extraction.streamCopy) {
      return [
        ...base,
        '-i',
        task.inputPath,
        '-map_metadata',
        '0',
        '-n',
        '-vn',
        '-sn',
        '-c:a',
        'copy',
        task.outputPath,
      ];
    }
    const profile = audioProfile(task.targetFormat as AudioTargetFormat, task.quality);
    return [
      ...base,
      '-i',
      task.inputPath,
      '-map_metadata',
      '0',
      '-n',
      '-vn',
      '-sn',
      '-c:a',
      profile.codec,
      ...profile.args,
      task.outputPath,
    ];
  }

  let codecArgs: string[] = [];
  if (task.category === 'audio') {
    const profile = audioProfile(task.targetFormat as AudioTargetFormat, task.quality);
    codecArgs = ['-vn', '-sn', '-c:a', profile.codec, ...profile.args];
  } else {
    const profile = videoProfile(task.targetFormat as VideoTargetFormat, task.quality);
    codecArgs = ['-sn', ...profile.videoArgs, ...profile.audioArgs];
    if (task.targetFormat === 'mp4' || task.targetFormat === 'mov') {
      codecArgs.push('-movflags', '+faststart');
    }
  }

  return [...base, '-i', task.inputPath, '-map_metadata', '0', '-n', ...codecArgs, task.outputPath];
}
