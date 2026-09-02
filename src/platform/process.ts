import { spawn } from 'node:child_process';

export interface SpawnHandlers {
  onStdout?: (chunk: Buffer) => void;
  onStderr?: (chunk: Buffer) => void;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface SpawnResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface TrackedProcess {
  readonly exited: Promise<SpawnResult>;
  kill(): void;
}

export function spawnTracked(
  command: string,
  args: readonly string[],
  handlers: SpawnHandlers = {},
): TrackedProcess {
  const child = spawn(command, [...args], {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: handlers.cwd,
    env: handlers.env,
  });

  child.stdout.on('data', (chunk: Buffer) => handlers.onStdout?.(chunk));
  child.stderr.on('data', (chunk: Buffer) => handlers.onStderr?.(chunk));

  const exited = new Promise<SpawnResult>((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
    child.on('error', () => resolve({ code: null, signal: null }));
  });

  return {
    exited,
    kill() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGKILL');
    },
  };
}

export function createTailBuffer(maxLines = 40): { push(line: string): void; content(): string } {
  const lines: string[] = [];
  return {
    push(line) {
      lines.push(line);
      if (lines.length > maxLines) lines.shift();
    },
    content: () => lines.join('\n'),
  };
}

export function createLineReader(): { push(chunk: string): string[]; flush(): string[] } {
  let pending = '';
  return {
    push(chunk) {
      pending += chunk;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      return parts;
    },
    flush() {
      if (pending === '') return [];
      const out = [pending];
      pending = '';
      return out;
    },
  };
}
