import { pino, type Logger as PinoLogger } from 'pino';

export interface LoggerOptions {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  pretty?: boolean;
  silent?: boolean;
}

class Logger {
  private logger: PinoLogger;
  private static instance: Logger;

  private constructor(options: LoggerOptions = {}) {
    const { level = 'info', pretty = process.env.NODE_ENV !== 'production', silent = false } = options;

    this.logger = pino({
      level: silent ? 'silent' : level,
      transport: pretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  static resetInstance(): void {
    Logger.instance = undefined as any;
  }

  trace(msg: string, ...args: any[]): void {
    this.logger.trace(msg, ...args);
  }

  debug(msg: string, ...args: any[]): void {
    this.logger.debug(msg, ...args);
  }

  info(msg: string, ...args: any[]): void {
    this.logger.info(msg, ...args);
  }

  warn(msg: string, ...args: any[]): void {
    this.logger.warn(msg, ...args);
  }

  error(msg: string | Error, ...args: any[]): void {
    if (msg instanceof Error) {
      this.logger.error({ err: msg }, msg.message, ...args);
    } else {
      this.logger.error(msg, ...args);
    }
  }

  fatal(msg: string | Error, ...args: any[]): void {
    if (msg instanceof Error) {
      this.logger.fatal({ err: msg }, msg.message, ...args);
    } else {
      this.logger.fatal(msg, ...args);
    }
  }

  child(bindings: Record<string, any>): PinoLogger {
    return this.logger.child(bindings);
  }
}

export const logger = Logger.getInstance();
export const createLogger = (options?: LoggerOptions) => Logger.getInstance(options);
export const resetLogger = () => Logger.resetInstance();
