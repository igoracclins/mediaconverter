import { describe, expect, it } from 'vitest';
import { JobQueue } from '../queue';
import type { CreateJobInput } from '../job';

function job(id: string): CreateJobInput {
  return {
    id,
    operation: 'convert',
    name: `${id}.ogg`,
    sourceExtension: 'ogg',
    category: 'audio',
    targetFormat: 'mp3',
    quality: 'high',
    inputPath: `/tmp/${id}.ogg`,
  };
}

describe('JobQueue', () => {
  it('adds jobs FIFO and exposes next()', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.add(job('b'));
    queue.add(job('c'));
    expect(queue.next()?.id).toBe('a');
    expect(queue.size).toBe(3);
  });

  it('returns the first pending job even after some start', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.add(job('b'));
    queue.add(job('c'));
    queue.get('a')!.status = 'processing';
    expect(queue.next()?.id).toBe('b');
  });

  it('counts by status', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.add(job('b'));
    queue.get('a')!.status = 'completed';
    queue.get('b')!.status = 'processing';
    expect(queue.countByStatus()).toEqual({
      pending: 0,
      processing: 1,
      completed: 1,
      failed: 0,
      cancelled: 0,
    });
  });

  it('cancels a pending job inline', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    const result = queue.requestCancel('a');
    expect(result).toEqual({ status: 'cancelled' });
    expect(queue.get('a')?.status).toBe('cancelled');
    expect(queue.next()).toBeNull();
  });

  it('defers cancellation of processing jobs to the runner', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.get('a')!.status = 'processing';
    expect(queue.requestCancel('a')).toEqual({ status: 'processing' });
  });

  it('rejects removing a processing job', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.get('a')!.status = 'processing';
    expect(queue.remove('a')).toBe(false);
    expect(queue.size).toBe(1);
  });

  it('removes pending and terminal jobs', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.add(job('b'));
    queue.requestCancel('b');
    expect(queue.remove('b')).toBe(true);
    expect(queue.size).toBe(1);
  });

  it('clears only completed/failed/cancelled', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.add(job('b'));
    queue.get('a')!.status = 'completed';
    queue.get('b')!.status = 'pending';
    expect(queue.clearCompleted()).toBe(1);
    expect(queue.size).toBe(1);
    expect(queue.get('b')).toBeDefined();
  });

  it('produces a consistent snapshot', () => {
    const queue = new JobQueue();
    queue.add(job('a'));
    queue.add(job('b'));
    queue.get('a')!.status = 'completed';
    const snap = queue.snapshot(true, 1);
    expect(snap.running).toBe(true);
    expect(snap.activeCount).toBe(1);
    expect(snap.jobs).toHaveLength(2);
    expect(snap.jobs.map((j) => j.id)).toEqual(['a', 'b']);
  });
});
