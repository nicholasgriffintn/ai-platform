export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3,
	TRACE = 4,
}

export interface LoggerOptions {
	level?: LogLevel;
	prefix?: string;
	defaultMeta?: Record<string, unknown>;
	requestId?: string;
}

class Logger {
	private static instances: Record<string, Logger> = {};
	private static defaultLevel = resolveLogLevelFromEnv();
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
		if (level > this.level) {
			return;
		}

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

	public withContext(meta: Record<string, any>): LoggerAdapter {
		return new LoggerAdapter(this, meta);
	}
}

class LoggerAdapter {
	constructor(
		private base: Logger,
		private context: Record<string, any>,
	) {}

	public error(message: string, ...args: any[]) {
		this.base.error(message, ...args, this.context);
	}

	public warn(message: string, ...args: any[]) {
		this.base.warn(message, ...args, this.context);
	}

	public info(message: string, ...args: any[]) {
		this.base.info(message, ...args, this.context);
	}

	public debug(message: string, ...args: any[]) {
		this.base.debug(message, ...args, this.context);
	}

	public trace(message: string, ...args: any[]) {
		this.base.trace(message, ...args, this.context);
	}

	public setLevel(level: LogLevel) {
		this.base.setLevel(level);
	}
}

function resolveLogLevelFromEnv(): LogLevel {
	const value =
		(typeof globalThis !== "undefined" &&
		typeof (globalThis as Record<string, any>).LOG_LEVEL === "string"
			? ((globalThis as Record<string, any>).LOG_LEVEL as string)
			: typeof process !== "undefined" && process?.env?.LOG_LEVEL
				? process.env.LOG_LEVEL
				: undefined) ?? "";

	if (!value) {
		return LogLevel.ERROR;
	}

	const normalized = value.toUpperCase();
	switch (normalized) {
		case "TRACE":
			return LogLevel.TRACE;
		case "DEBUG":
			return LogLevel.DEBUG;
		case "INFO":
			return LogLevel.INFO;
		case "WARN":
			return LogLevel.WARN;
		case "ERROR":
		default:
			return LogLevel.ERROR;
	}
}

export const getLogger = (options?: LoggerOptions) => {
	const instanceOptions: LoggerOptions = {
		prefix: options?.prefix,
		level: options?.level,
	};

	if (!options) {
		instanceOptions.level = LogLevel.INFO;
	}

	const baseLogger = Logger.getInstance(instanceOptions);

	const mergedMeta = {
		...(options?.defaultMeta ?? {}),
		...(options?.requestId ? { requestId: options.requestId } : {}),
	};

	if (Object.keys(mergedMeta).length > 0) {
		return baseLogger.withContext(mergedMeta);
	}

	return baseLogger;
};

export default Logger;
