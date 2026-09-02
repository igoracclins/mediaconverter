import { statSync } from 'node:fs';
import { evaluateCompression } from '@conversion/compress';
import { probeMedia } from '@conversion/ffmpeg/probe';
import { detectPath } from '@core/detect';
import type { CompressionEstimate, CompressionEstimateRequest } from '@shared/ipc';

function invalid(): CompressionEstimate {
  return {
    status: 'unsupported',
    currentSizeMb: 0,
    recommendedMinMb: null,
    hardMinMb: null,
    unsupportedReason: 'invalid',
  };
}

export async function estimateCompression(
  ffprobeBin: string,
  request: CompressionEstimateRequest,
): Promise<CompressionEstimate> {
  const detected = detectPath(request.inputPath);
  if (!detected) return invalid();

  let sizeBytes = 0;
  try {
    sizeBytes = statSync(request.inputPath).size;
  } catch {
    return invalid();
  }

  let probe = { durationMs: null as number | null, hasVideo: false, hasAudio: false };
  if (detected.category !== 'image') {
    probe = await probeMedia(ffprobeBin, request.inputPath);
  }

  return evaluateCompression({
    category: detected.category,
    targetFormat: request.targetFormat,
    maxSizeMb: request.maxSizeMb,
    sizeBytes,
    durationMs: probe.durationMs,
    hasVideo: probe.hasVideo,
    hasAudio: probe.hasAudio,
  }).estimate;
}
