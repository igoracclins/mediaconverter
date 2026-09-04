import type { QueueSnapshot } from '@shared/ipc';
import type { JobStatus } from '@shared/types';
import { cancel, createJob, snapshot, type CreateJobInput, type InternalJob } from './job';

export type CancelResult =
  | { status: 'cancelled' }
  | { status: 'missing' }
  | { status: 'processing' }
  | { status: 'terminal' };

export class JobQueue {
  private items: InternalJob[] = [];
  private byId = new Map<string, InternalJob>();

  get size(): number {
    return this.items.length;
  }

  add(input: CreateJobInput): InternalJob {
    const job = createJob(input);
    this.items.push(job);
    this.byId.set(job.id, job);
    return job;
  }

  get(id: string): InternalJob | undefined {
    return this.byId.get(id);
  }

  replace(job: InternalJob): InternalJob {
    const idx = this.items.findIndex((item) => item.id === job.id);
    if (idx < 0) return job;
    this.items[idx] = job;
    this.byId.set(job.id, job);
    return job;
  }

  all(): InternalJob[] {
    return this.items;
  }

  remove(id: string): boolean {
    const job = this.byId.get(id);
    if (!job) return false;
    if (job.status === 'processing') return false;
    this.byId.delete(id);
    this.items = this.items.filter((item) => item.id !== id);
    return true;
  }

  clearCompleted(): number {
    const before = this.items.length;
    this.items = this.items.filter(
      (job) => !['completed', 'failed', 'cancelled'].includes(job.status),
    );
    this.byId = new Map(this.items.map((job) => [job.id, job]));
    return before - this.items.length;
  }

  next(): InternalJob | null {
    return this.items.find((job) => job.status === 'pending') ?? null;
  }

  requestCancel(id: string): CancelResult {
    const job = this.byId.get(id);
    if (!job) return { status: 'missing' };
    if (job.status === 'pending') {
      const cancelled = cancel(job);
      this.byId.set(id, cancelled);
      this.items = this.items.map((item) => (item.id === id ? cancelled : item));
      return { status: 'cancelled' };
    }
    if (job.status === 'processing') return { status: 'processing' };
    return { status: 'terminal' };
  }

  countByStatus(): Record<JobStatus, number> {
    const counts: Record<JobStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const job of this.items) counts[job.status] += 1;
    return counts;
  }

  snapshot(running: boolean, activeCount: number): QueueSnapshot {
    return {
      jobs: this.items.map(snapshot),
      running,
      activeCount,
    };
  }
}
