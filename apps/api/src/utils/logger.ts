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
  private static instance: Logger;
  private static readonly defaultLevel = LogLevel.DEBUG;
  private level: LogLevel;
  private prefix: string;

  private constructor(options: LoggerOptions) {
    this.prefix = options.prefix || "";
    this.level = options.level ?? Logger.defaultLevel;
  }

  public static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options || { level: Logger.defaultLevel });
    } else if (options) {
      if (options.level !== undefined) {
        Logger.instance.level = options.level;
      }
      if (options.prefix !== undefined) {
        Logger.instance.prefix = options.prefix;
      }
    }

    return Logger.instance;
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = new Date().toISOString();

    const logObject: Record<string, any> = {
      timestamp,
      level,
      prefix: this.prefix || undefined,
      message,
    };

    if (args.length > 0 && typeof args[0] === "object") {
      // Merge the first object argument with our log object
      Object.assign(logObject, args[0]);

      // Remove these if they were added as separate properties to avoid duplication
      args.shift();
    }

    // Add remaining args as an array if any exist
    if (args.length > 0) {
      logObject.additionalArgs = args.map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      });
    }

    return JSON.stringify(logObject);
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
