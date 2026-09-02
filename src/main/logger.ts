const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

function shouldLog(level: Level, threshold: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(threshold);
}

export class Logger {
  private threshold: Level;
  private sink: ((line: string) => void) | null = null;

  constructor(threshold: Level = 'info') {
    this.threshold = threshold;
  }

  attachSink(sink: (line: string) => void): void {
    this.sink = sink;
  }

  private write(level: Level, scope: string, msg: string): void {
    if (!shouldLog(level, this.threshold)) return;
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} [${scope}] ${msg}`;
    if (level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
    this.sink?.(`${line}\n`);
  }

  debug(scope: string, msg: string): void {
    this.write('debug', scope, msg);
  }

  info(scope: string, msg: string): void {
    this.write('info', scope, msg);
  }

  warn(scope: string, msg: string): void {
    this.write('warn', scope, msg);
  }

  error(scope: string, msg: string): void {
    this.write('error', scope, msg);
  }
}

export const logger = new Logger();
