export interface ProgressSample {
  outTimeUs: number | null;
  frame: number | null;
  finished: boolean;
}

export function parseProgressLine(line: string): Partial<Record<string, string>> {
  const trimmed = line.trim();
  if (trimmed === '') return {};
  const idx = trimmed.indexOf('=');
  if (idx <= 0) return {};
  return { [trimmed.slice(0, idx)]: trimmed.slice(idx + 1) };
}

export function parseProgressChunk(chunk: string): ProgressSample {
  let outTimeUs: number | null = null;
  let frame: number | null = null;
  let finished = false;
  for (const line of chunk.split('\n')) {
    const parsed = parseProgressLine(line);
    const outUs = parsed.out_time_us;
    const f = parsed.frame;
    const progress = parsed.progress;
    if (outUs !== undefined && outUs !== 'N/A') {
      const n = Number(outUs);
      if (Number.isFinite(n)) outTimeUs = n;
    }
    if (f !== undefined && f !== 'N/A') {
      const n = Number(f);
      if (Number.isFinite(n)) frame = n;
    }
    if (progress === 'end') finished = true;
  }
  return { outTimeUs, frame, finished };
}

export function computeProgress(
  outTimeUs: number | null,
  durationMs: number | null,
): number | null {
  if (outTimeUs === null || durationMs === null || durationMs <= 0) return null;
  const pct = (outTimeUs / 1000 / durationMs) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
