import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogLevel, getLogger } from "../logger";

describe("logger", () => {
	let consoleSpy: {
		error: ReturnType<typeof vi.spyOn>;
		warn: ReturnType<typeof vi.spyOn>;
		info: ReturnType<typeof vi.spyOn>;
		debug: ReturnType<typeof vi.spyOn>;
		trace: ReturnType<typeof vi.spyOn>;
		log: ReturnType<typeof vi.spyOn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		consoleSpy = {
			error: vi.spyOn(console, "error").mockImplementation(() => {}),
			warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
			info: vi.spyOn(console, "info").mockImplementation(() => {}),
			debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
			trace: vi.spyOn(console, "trace").mockImplementation(() => {}),
			log: vi.spyOn(console, "log").mockImplementation(() => {}),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("LogLevel enum", () => {
		it("should have correct numeric values", () => {
			expect(LogLevel.ERROR).toBe(0);
			expect(LogLevel.WARN).toBe(1);
			expect(LogLevel.INFO).toBe(2);
			expect(LogLevel.DEBUG).toBe(3);
			expect(LogLevel.TRACE).toBe(4);
		});
	});

	describe("getLogger", () => {
		it("should create logger with default options", () => {
			const logger = getLogger();

			logger.info("Test message");

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining('"message":"Test message"'),
			);
		});

		it("should create logger with custom prefix", () => {
			const logger = getLogger({ prefix: "TEST" });
			logger.setLevel(LogLevel.INFO);

			logger.info("Test message");

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining('"prefix":"TEST"'),
			);
		});

		it("should create logger with custom log level", () => {
			const logger = getLogger({ level: LogLevel.ERROR });

			logger.error("Error message");
			logger.warn("Warn message");

			expect(consoleSpy.error).toHaveBeenCalled();
			expect(consoleSpy.warn).not.toHaveBeenCalled();
		});

		it("should return same instance for same prefix", () => {
			const logger1 = getLogger({ prefix: "SAME" });
			const logger2 = getLogger({ prefix: "SAME" });

			expect(logger1).toBe(logger2);
		});

		it("should return different instances for different prefixes", () => {
			const logger1 = getLogger({ prefix: "FIRST" });
			const logger2 = getLogger({ prefix: "SECOND" });

			expect(logger1).not.toBe(logger2);
		});
	});

	describe("logging methods", () => {
		it("should log error messages", () => {
			const logger = getLogger({ level: LogLevel.ERROR });

			logger.error("Error occurred");

			expect(consoleSpy.error).toHaveBeenCalledWith(
				expect.stringContaining('"level":"ERROR"'),
			);
			expect(consoleSpy.error).toHaveBeenCalledWith(
				expect.stringContaining('"message":"Error occurred"'),
			);
		});

		it("should log warn messages", () => {
			const logger = getLogger({ level: LogLevel.WARN });

			logger.warn("Warning message");

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				expect.stringContaining('"level":"WARN"'),
			);
			expect(consoleSpy.warn).toHaveBeenCalledWith(
				expect.stringContaining('"message":"Warning message"'),
			);
		});

		it("should log info messages", () => {
			const logger = getLogger({ level: LogLevel.INFO });

			logger.info("Info message");

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining('"level":"INFO"'),
			);
			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining('"message":"Info message"'),
			);
		});

		it("should log debug messages", () => {
			const logger = getLogger({ level: LogLevel.DEBUG });

			logger.debug("Debug message");

			expect(consoleSpy.debug).toHaveBeenCalledWith(
				expect.stringContaining('"level":"DEBUG"'),
			);
			expect(consoleSpy.debug).toHaveBeenCalledWith(
				expect.stringContaining('"message":"Debug message"'),
			);
		});

		it("should log trace messages", () => {
			const logger = getLogger({ level: LogLevel.TRACE });

			logger.trace("Trace message");

			expect(consoleSpy.trace).toHaveBeenCalledWith(
				expect.stringContaining('"level":"TRACE"'),
			);
			expect(consoleSpy.trace).toHaveBeenCalledWith(
				expect.stringContaining('"message":"Trace message"'),
			);
		});
	});

	describe("log level filtering", () => {
		it("should only log ERROR when level is ERROR", () => {
			const logger = getLogger({ level: LogLevel.ERROR });

			logger.error("Error");
			logger.warn("Warn");
			logger.info("Info");
			logger.debug("Debug");
			logger.trace("Trace");

			expect(consoleSpy.error).toHaveBeenCalled();
			expect(consoleSpy.warn).not.toHaveBeenCalled();
			expect(consoleSpy.info).not.toHaveBeenCalled();
			expect(consoleSpy.debug).not.toHaveBeenCalled();
			expect(consoleSpy.trace).not.toHaveBeenCalled();
		});

		it("should log ERROR and WARN when level is WARN", () => {
			const logger = getLogger({ level: LogLevel.WARN });

			logger.error("Error");
			logger.warn("Warn");
			logger.info("Info");
			logger.debug("Debug");
			logger.trace("Trace");

			expect(consoleSpy.error).toHaveBeenCalled();
			expect(consoleSpy.warn).toHaveBeenCalled();
			expect(consoleSpy.info).not.toHaveBeenCalled();
			expect(consoleSpy.debug).not.toHaveBeenCalled();
			expect(consoleSpy.trace).not.toHaveBeenCalled();
		});

		it("should log ERROR, WARN, and INFO when level is INFO", () => {
			const logger = getLogger({ level: LogLevel.INFO });

			logger.error("Error");
			logger.warn("Warn");
			logger.info("Info");
			logger.debug("Debug");
			logger.trace("Trace");

			expect(consoleSpy.error).toHaveBeenCalled();
			expect(consoleSpy.warn).toHaveBeenCalled();
			expect(consoleSpy.info).toHaveBeenCalled();
			expect(consoleSpy.debug).not.toHaveBeenCalled();
			expect(consoleSpy.trace).not.toHaveBeenCalled();
		});

		it("should log all except TRACE when level is DEBUG", () => {
			const logger = getLogger({ level: LogLevel.DEBUG });

			logger.error("Error");
			logger.warn("Warn");
			logger.info("Info");
			logger.debug("Debug");
			logger.trace("Trace");

			expect(consoleSpy.error).toHaveBeenCalled();
			expect(consoleSpy.warn).toHaveBeenCalled();
			expect(consoleSpy.info).toHaveBeenCalled();
			expect(consoleSpy.debug).toHaveBeenCalled();
			expect(consoleSpy.trace).not.toHaveBeenCalled();
		});

		it("should log all levels when level is TRACE", () => {
			const logger = getLogger({ level: LogLevel.TRACE });

			logger.error("Error");
			logger.warn("Warn");
			logger.info("Info");
			logger.debug("Debug");
			logger.trace("Trace");

			expect(consoleSpy.error).toHaveBeenCalled();
			expect(consoleSpy.warn).toHaveBeenCalled();
			expect(consoleSpy.info).toHaveBeenCalled();
			expect(consoleSpy.debug).toHaveBeenCalled();
			expect(consoleSpy.trace).toHaveBeenCalled();
		});
	});

	describe("message formatting", () => {
		it("should include timestamp in log output", () => {
			const logger = getLogger();

			logger.info("Test message");

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining('"timestamp":'),
			);
		});

		it("should include level in log output", () => {
			const logger = getLogger();

			logger.error("Error message");

			expect(consoleSpy.error).toHaveBeenCalledWith(
				expect.stringContaining('"level":"ERROR"'),
			);
		});

		it("should include prefix when provided", () => {
			const logger = getLogger({ prefix: "TEST_PREFIX" });
			logger.setLevel(LogLevel.INFO);

			logger.info("Test message");

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining('"prefix":"TEST_PREFIX"'),
			);
		});

		it("should not include prefix when not provided", () => {
			const logger = getLogger();

			logger.info("Test message");

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.prefix).toBeUndefined();
		});
	});

	describe("metadata handling", () => {
		it("should include object metadata", () => {
			const logger = getLogger();
			const metadata = { userId: 123, operation: "test" };

			logger.info("Test message", metadata);

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.meta).toEqual(metadata);
		});

		it("should merge multiple object arguments", () => {
			const logger = getLogger();
			const meta1 = { userId: 123 };
			const meta2 = { operation: "test" };

			logger.info("Test message", meta1, meta2);

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.meta).toEqual({ userId: 123, operation: "test" });
		});

		it("should handle non-object arguments", () => {
			const logger = getLogger();

			logger.info("Test message", "string arg", 123, true);

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.additionalArgs).toEqual(["string arg", "123", "true"]);
		});

		it("should handle mixed object and non-object arguments", () => {
			const logger = getLogger();
			const metadata = { userId: 123 };

			logger.info("Test message", metadata, "string arg", 456);

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.meta).toEqual({ userId: 123 });
			expect(parsed.additionalArgs).toEqual(["string arg", "456"]);
		});

		it("should handle arrays as additional arguments", () => {
			const logger = getLogger();

			logger.info("Test message", ["item1", "item2"]);

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.additionalArgs).toEqual(['["item1","item2"]']);
		});

		it("should handle null arguments", () => {
			const logger = getLogger();

			logger.info("Test message", null);

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.additionalArgs).toEqual(["null"]);
		});
	});

	describe("error handling", () => {
		it("should handle circular reference in metadata", () => {
			const logger = getLogger();
			const circular: any = { name: "test" };
			circular.self = circular;

			logger.info("Test message", circular);

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining(
					'"message":"Test message [unserializable payload]"',
				),
			);
		});

		it("should handle unserializable objects gracefully", () => {
			const logger = getLogger();
			const unserializable = {
				toJSON: () => {
					throw new Error("Cannot serialize");
				},
			};

			logger.info("Test message", unserializable);

			expect(consoleSpy.info).toHaveBeenCalledWith(
				expect.stringContaining(
					'"message":"Test message [unserializable payload]"',
				),
			);
		});
	});

	describe("setLevel method", () => {
		it("should update log level dynamically", () => {
			const logger = getLogger({ level: LogLevel.ERROR });

			logger.info("Should not log");
			expect(consoleSpy.info).not.toHaveBeenCalled();

			logger.setLevel(LogLevel.INFO);
			logger.info("Should log now");
			expect(consoleSpy.info).toHaveBeenCalled();
		});

		it("should affect existing logger instance", () => {
			const logger1 = getLogger({ prefix: "TEST", level: LogLevel.ERROR });
			const logger2 = getLogger({ prefix: "TEST" });

			logger1.setLevel(LogLevel.INFO);
			logger2.info("Should log");

			expect(consoleSpy.info).toHaveBeenCalled();
		});
	});

	describe("singleton behavior", () => {
		it("should update level on existing instance when creating with same prefix", () => {
			const logger1 = getLogger({ prefix: "SAME", level: LogLevel.ERROR });
			const logger2 = getLogger({ prefix: "SAME", level: LogLevel.INFO });

			expect(logger1).toBe(logger2);

			logger1.info("Should log");
			expect(consoleSpy.info).toHaveBeenCalled();
		});

		it("should not update level when no level provided on subsequent calls", () => {
			const logger1 = getLogger({ prefix: "SAME", level: LogLevel.ERROR });
			const _logger2 = getLogger({ prefix: "SAME" });

			logger1.info("Should not log");
			expect(consoleSpy.info).not.toHaveBeenCalled();
		});
	});

	describe("default behavior", () => {
		it("should use ERROR as default level", () => {
			const logger = getLogger({ prefix: "DEFAULT_TEST" });

			logger.debug("Debug message");
			logger.trace("Trace message");
			logger.info("Info message");
			logger.warn("Warn message");
			logger.error("Error message");

			expect(consoleSpy.debug).not.toHaveBeenCalled();
			expect(consoleSpy.trace).not.toHaveBeenCalled();
			expect(consoleSpy.info).not.toHaveBeenCalled();
			expect(consoleSpy.warn).not.toHaveBeenCalled();
			expect(consoleSpy.error).toHaveBeenCalled();
		});

		it("should handle empty prefix", () => {
			const logger = getLogger({ prefix: "" });

			logger.info("Test message");

			const logOutput = consoleSpy.info.mock.calls[0][0] as string;
			const parsed = JSON.parse(logOutput);
			expect(parsed.prefix).toBeUndefined();
		});
	});
});
