export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

class Logger {
  private static instances: Record<string, Logger> = {};
  private static readonly defaultLevel = LogLevel.DEBUG;
  private level: LogLevel;
  private prefix: string;

  private constructor(options: LoggerOptions) {
    this.prefix = options.prefix || "";
    this.level = options.level ?? Logger.defaultLevel;
  }

  public static getInstance(options?: LoggerOptions): Logger {
    const prefix = options?.prefix ?? "";
    const level = options?.level ?? Logger.defaultLevel;
    if (!Logger.instances[prefix]) {
      Logger.instances[prefix] = new Logger({ prefix, level });
    } else if (options?.level !== undefined) {
      Logger.instances[prefix].level = options.level;
    }

    return Logger.instances[prefix];
  }

  private formatMessage(
    levelName: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = new Date().toISOString();
    const logObject: Record<string, any> = {
      timestamp,
      level: levelName,
      prefix: this.prefix || undefined,
      message,
    };

    const meta: Record<string, any> = {};
    const remainingArgs: any[] = [];

    for (const arg of args) {
      if (arg !== null && typeof arg === "object" && !Array.isArray(arg)) {
        Object.assign(meta, arg);
      } else {
        remainingArgs.push(arg);
      }
    }

    if (Object.keys(meta).length > 0) {
      logObject.meta = meta;
    }

    if (remainingArgs.length > 0) {
      logObject.additionalArgs = remainingArgs.map((arg) => {
        if (arg !== null && typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      });
    }

    try {
      return JSON.stringify(logObject);
    } catch (_e) {
      return JSON.stringify({
        timestamp,
        level: levelName,
        prefix: this.prefix,
        message: `${message} [unserializable payload]`,
      });
    }
  }

  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    ...args: any[]
  ) {
    if (level > this.level) return;

    const formattedMessage = this.formatMessage(levelName, message, ...args);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.TRACE:
        console.trace(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  public error(message: string, ...args: any[]) {
    this.log(LogLevel.ERROR, "ERROR", message, ...args);
  }

  public warn(message: string, ...args: any[]) {
    this.log(LogLevel.WARN, "WARN", message, ...args);
  }

  public info(message: string, ...args: any[]) {
    this.log(LogLevel.INFO, "INFO", message, ...args);
  }

  public debug(message: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, "DEBUG", message, ...args);
  }

  public trace(message: string, ...args: any[]) {
    this.log(LogLevel.TRACE, "TRACE", message, ...args);
  }

  public setLevel(level: LogLevel) {
    this.level = level;
  }
}

export const getLogger = (options?: LoggerOptions) => {
  return Logger.getInstance(options);
};

export default Logger;
