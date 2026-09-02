import { describe, expect, it } from 'vitest';
import {
  cancel,
  complete,
  createJob,
  fail,
  setProgress,
  snapshot,
  start,
  transition,
} from '../job';
import type { CreateJobInput } from '../job';

const base: CreateJobInput = {
  id: 'j1',
  name: 'song.ogg',
  sourceExtension: 'ogg',
  category: 'audio',
  targetFormat: 'mp3',
  quality: 'high',
  inputPath: '/tmp/song.ogg',
};

describe('job lifecycle', () => {
  it('creates a pending job with sane defaults', () => {
    const job = createJob(base);
    expect(job.status).toBe('pending');
    expect(job.progress).toBeNull();
    expect(job.startedAt).toBeNull();
    expect(job.finishedAt).toBeNull();
  });

  it('follows a valid lifecycle', () => {
    let job = createJob(base, 1000);
    job = start(job);
    expect(job.status).toBe('processing');
    expect(job.startedAt).not.toBeNull();
    job = setProgress(job, 0.5);
    expect(job.progress).toBe(1);
    job = complete(job, '/tmp/song.mp3');
    expect(job.status).toBe('completed');
    expect(job.outputPath).toBe('/tmp/song.mp3');
    expect(job.finishedAt).not.toBeNull();
  });

  it('clamps progress to 0..100', () => {
    let job = start(createJob(base));
    job = setProgress(job, 150);
    expect(job.progress).toBe(100);
    job = setProgress(job, -5);
    expect(job.progress).toBe(0);
  });

  it('does not mutate progress outside processing', () => {
    const job = createJob(base);
    expect(setProgress(job, 50)).toBe(job);
  });
});

describe('transition validation', () => {
  it('allows pending -> cancelled', () => {
    expect(cancel(createJob(base)).status).toBe('cancelled');
  });

  it('allows processing -> cancelled/failed', () => {
    const processing = start(createJob(base));
    expect(cancel(processing).status).toBe('cancelled');
    expect(fail(processing, 'ENCODE_FAILED', 'boom').status).toBe('failed');
  });

  it('rejects invalid transitions', () => {
    const pending = createJob(base);
    expect(() => transition(pending, 'completed')).toThrow(/Invalid job transition/);
    const done = complete(start(createJob(base)), '/x/y.mp3');
    expect(() => transition(done, 'processing')).toThrow(/Invalid job transition/);
    expect(() => transition(done, 'failed')).toThrow(/Invalid job transition/);
  });
});

describe('snapshot', () => {
  it('exposes the renderer view', () => {
    const job = createJob(base, 42);
    const snap = snapshot(job);
    expect(snap).toEqual({
      id: 'j1',
      name: 'song.ogg',
      sourceExtension: 'ogg',
      category: 'audio',
      targetFormat: 'mp3',
      quality: 'high',
      status: 'pending',
      progress: null,
      errorCode: null,
      errorMessage: null,
      outputPath: null,
      createdAt: 42,
      startedAt: null,
      finishedAt: null,
    });
  });
});
