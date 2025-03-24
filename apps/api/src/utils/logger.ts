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
    let formattedMessage = `[${level}]${this.prefix ? ` [${this.prefix}]` : ""} ${message}`;

    if (args.length > 0) {
      const metaArgs = args.map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      });
      formattedMessage = `${formattedMessage} ${metaArgs.join(" ")}`;
    }

    return formattedMessage;
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
