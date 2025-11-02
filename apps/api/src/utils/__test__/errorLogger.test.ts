import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "../errorLogger";

const mockLogger = vi.hoisted(() => ({
	error: vi.fn(),
}));

vi.mock("../logger", () => ({
	getLogger: vi.fn(() => mockLogger),
}));

describe("errorLogger", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("logError", () => {
		it("should log error with message and basic error object", () => {
			const error = new Error("Test error");
			error.stack = "Error stack trace";

			logError("Something went wrong", error);

			expect(mockLogger.error).toHaveBeenCalledWith("Something went wrong", {
				message: "Test error",
				stack: "Error stack trace",
				name: "Error",
			});
		});

		it("should log error with additional context", () => {
			const error = new Error("Test error");
			const context = {
				userId: 123,
				path: "/api/test",
				operation: "getData",
			};

			logError("Operation failed", error, context);

			expect(mockLogger.error).toHaveBeenCalledWith("Operation failed", {
				message: "Test error",
				stack: error.stack,
				name: "Error",
				userId: 123,
				path: "/api/test",
				operation: "getData",
			});
		});

		it("should handle non-Error objects", () => {
			const notAnError = "String error";

			logError("String error occurred", notAnError);

			expect(mockLogger.error).toHaveBeenCalledWith("String error occurred", {
				message: "String error",
				stack: undefined,
				name: "string",
			});
		});

		it("should handle null error", () => {
			logError("Null error occurred", null);

			expect(mockLogger.error).toHaveBeenCalledWith("Null error occurred", {
				message: "null",
				stack: undefined,
				name: "object",
			});
		});

		it("should handle undefined error", () => {
			logError("Undefined error occurred", undefined);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Undefined error occurred",
				{
					message: "undefined",
					stack: undefined,
					name: "undefined",
				},
			);
		});

		it("should handle number error", () => {
			logError("Number error occurred", 404);

			expect(mockLogger.error).toHaveBeenCalledWith("Number error occurred", {
				message: "404",
				stack: undefined,
				name: "number",
			});
		});

		it("should handle object error", () => {
			const errorObj = { code: 500, details: "Server error" };

			logError("Object error occurred", errorObj);

			expect(mockLogger.error).toHaveBeenCalledWith("Object error occurred", {
				message: "[object Object]",
				stack: undefined,
				name: "object",
			});
		});

		it("should handle custom error classes", () => {
			class CustomError extends Error {
				code: number;

				constructor(message: string, code: number) {
					super(message);
					this.name = "CustomError";
					this.code = code;
				}
			}

			const error = new CustomError("Custom error message", 400);

			logError("Custom error occurred", error);

			expect(mockLogger.error).toHaveBeenCalledWith("Custom error occurred", {
				message: "Custom error message",
				stack: error.stack,
				name: "CustomError",
			});
		});

		it("should handle empty context", () => {
			const error = new Error("Test error");

			logError("Error occurred", error, {});

			expect(mockLogger.error).toHaveBeenCalledWith("Error occurred", {
				message: "Test error",
				stack: error.stack,
				name: "Error",
			});
		});

		it("should handle context with various data types", () => {
			const error = new Error("Test error");
			const context = {
				userId: 123,
				isActive: true,
				tags: ["error", "critical"],
				metadata: { timestamp: new Date("2023-01-01") },
				nullValue: null,
				undefinedValue: undefined,
			};

			logError("Complex context error", error, context);

			expect(mockLogger.error).toHaveBeenCalledWith("Complex context error", {
				message: "Test error",
				stack: error.stack,
				name: "Error",
				userId: 123,
				isActive: true,
				tags: ["error", "critical"],
				metadata: { timestamp: new Date("2023-01-01") },
				nullValue: null,
				undefinedValue: undefined,
			});
		});

		it("should handle error without stack trace", () => {
			const error = new Error("Test error");
			delete error.stack;

			logError("Error without stack", error);

			expect(mockLogger.error).toHaveBeenCalledWith("Error without stack", {
				message: "Test error",
				stack: undefined,
				name: "Error",
			});
		});

		it("should preserve all context properties", () => {
			const error = new Error("Test error");
			const context = {
				requestId: "req-123",
				userId: "user-456",
				path: "/api/users/456",
				method: "GET",
				statusCode: 500,
				duration: 1234,
				userAgent: "Mozilla/5.0...",
				ip: "192.168.1.1",
			};

			logError("Request failed", error, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Request failed",
				expect.objectContaining(context),
			);
		});

		it("should handle boolean error", () => {
			logError("Boolean error occurred", false);

			expect(mockLogger.error).toHaveBeenCalledWith("Boolean error occurred", {
				message: "false",
				stack: undefined,
				name: "boolean",
			});
		});

		it("should handle symbol error", () => {
			const symbol = Symbol("test");

			logError("Symbol error occurred", symbol);

			expect(mockLogger.error).toHaveBeenCalledWith("Symbol error occurred", {
				message: "Symbol(test)",
				stack: undefined,
				name: "symbol",
			});
		});

		it("should create logger with correct prefix", () => {
			logError("Test", new Error("test"));

			expect(mockLogger.error).toHaveBeenCalledWith("Test", {
				message: "test",
				stack: expect.any(String),
				name: "Error",
			});
		});

		it("should handle errors with circular references", () => {
			const error: any = new Error("Circular error");
			error.circular = error;

			logError("Circular reference error", error);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Circular reference error",
				{
					message: "Circular error",
					stack: error.stack,
					name: "Error",
				},
			);
		});
	});
});
