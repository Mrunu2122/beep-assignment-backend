type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.format('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(this.format('error', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.debug(this.format('debug', message, meta));
    }
  }
}

export const logger = new Logger();
