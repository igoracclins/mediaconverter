import { spawn } from 'node:child_process';

export interface ProbeMedia {
  durationMs: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export function probeDuration(ffprobeBin: string, inputPath: string): Promise<number | null> {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ];
  return new Promise((resolve) => {
    const child = spawn(ffprobeBin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve(null);
        return;
      }
      const seconds = Number(out.trim());
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null);
    });
    child.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

function parseProbe(json: string): ProbeMedia {
  try {
    const data = JSON.parse(json) as {
      format?: { duration?: string };
      streams?: { codec_type?: string }[];
    };
    const duration = Number(data.format?.duration);
    const streams = data.streams ?? [];
    return {
      durationMs: Number.isFinite(duration) && duration > 0 ? duration * 1000 : null,
      hasVideo: streams.some((s) => s.codec_type === 'video'),
      hasAudio: streams.some((s) => s.codec_type === 'audio'),
    };
  } catch {
    return { durationMs: null, hasVideo: false, hasAudio: false };
  }
}

export function probeMedia(ffprobeBin: string, inputPath: string): Promise<ProbeMedia> {
  const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inputPath];
  return new Promise((resolve) => {
    const child = spawn(ffprobeBin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);
    const settle = (): void => {
      clearTimeout(timeout);
      resolve(parseProbe(out));
    };
    child.on('close', () => settle());
    child.on('error', () => settle());
  });
}
