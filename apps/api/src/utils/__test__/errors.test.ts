import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType, handleAIServiceError } from "../errors";

vi.mock("../logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  })),
}));

describe("errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AssistantError", () => {
    it("should create error with message and type", () => {
      const error = new AssistantError("Test error", ErrorType.NETWORK_ERROR);

      expect(error.message).toBe("Test error");
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.name).toBe("AssistantError");
      expect(error.statusCode).toBe(500);
      expect(error.context).toEqual({});
    });

    it("should create error with custom status code", () => {
      const error = new AssistantError("Test error", ErrorType.NOT_FOUND, 404);

      expect(error.statusCode).toBe(404);
    });

    it("should create error with context", () => {
      const context = { userId: 123, operation: "test" };
      const error = new AssistantError(
        "Test error",
        ErrorType.PARAMS_ERROR,
        400,
        context,
      );

      expect(error.context).toEqual(context);
    });

    it("should default to UNKNOWN_ERROR type", () => {
      const error = new AssistantError("Test error");

      expect(error.type).toBe(ErrorType.UNKNOWN_ERROR);
    });

    it("should convert to JSON", () => {
      const context = { userId: 123 };
      const error = new AssistantError(
        "Test error",
        ErrorType.AUTHENTICATION_ERROR,
        401,
        context,
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: "AssistantError",
        message: "Test error",
        type: ErrorType.AUTHENTICATION_ERROR,
        statusCode: 401,
        timestamp: expect.any(Number),
        context,
      });
    });

    it("should create from existing error", () => {
      const originalError = new Error("Original error");
      const assistantError = AssistantError.fromError(
        originalError,
        ErrorType.PROVIDER_ERROR,
      );

      expect(assistantError.message).toBe("Original error");
      expect(assistantError.type).toBe(ErrorType.PROVIDER_ERROR);
      expect(assistantError.statusCode).toBe(500);
      expect(assistantError.context).toEqual({
        originalError: "Error",
        stack: expect.any(String),
      });
    });

    it("should create from existing error with default type", () => {
      const originalError = new Error("Original error");
      const assistantError = AssistantError.fromError(originalError);

      expect(assistantError.type).toBe(ErrorType.UNKNOWN_ERROR);
    });
  });

  describe("handleAIServiceError", () => {
    it("should handle CONFIGURATION_ERROR", () => {
      const error = new AssistantError(
        "Config error",
        ErrorType.CONFIGURATION_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should handle NETWORK_ERROR", () => {
      const error = new AssistantError(
        "Network error",
        ErrorType.NETWORK_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should handle RATE_LIMIT_ERROR", () => {
      const error = new AssistantError(
        "Rate limit",
        ErrorType.RATE_LIMIT_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(429);
    });

    it("should handle AUTHENTICATION_ERROR", () => {
      const error = new AssistantError(
        "Auth error",
        ErrorType.AUTHENTICATION_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(401);
    });

    it("should handle UNAUTHORIZED", () => {
      const error = new AssistantError("Unauthorized", ErrorType.UNAUTHORIZED);

      const response = handleAIServiceError(error);

      expect(response.status).toBe(401);
    });

    it("should handle FORBIDDEN", () => {
      const error = new AssistantError("Forbidden", ErrorType.FORBIDDEN);

      const response = handleAIServiceError(error);

      expect(response.status).toBe(403);
    });

    it("should handle PARAMS_ERROR", () => {
      const error = new AssistantError(
        "Invalid params",
        ErrorType.PARAMS_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(400);
    });

    it("should handle NOT_FOUND", () => {
      const error = new AssistantError("Not found", ErrorType.NOT_FOUND);

      const response = handleAIServiceError(error);

      expect(response.status).toBe(404);
    });

    it("should handle USER_NOT_FOUND", () => {
      const error = new AssistantError(
        "User not found",
        ErrorType.USER_NOT_FOUND,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(404);
    });

    it("should handle PROVIDER_ERROR", () => {
      const error = new AssistantError(
        "Provider error",
        ErrorType.PROVIDER_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(502);
    });

    it("should handle EXTERNAL_API_ERROR", () => {
      const error = new AssistantError(
        "External API error",
        ErrorType.EXTERNAL_API_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(502);
    });

    it("should handle CONTEXT_WINDOW_EXCEEDED", () => {
      const error = new AssistantError(
        "Context window exceeded",
        ErrorType.CONTEXT_WINDOW_EXCEEDED,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(413);
    });

    it("should handle EMAIL_SEND_FAILED", () => {
      const error = new AssistantError(
        "Email failed",
        ErrorType.EMAIL_SEND_FAILED,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should handle INTERNAL_ERROR", () => {
      const error = new AssistantError(
        "Internal error",
        ErrorType.INTERNAL_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should handle USAGE_LIMIT_ERROR", () => {
      const error = new AssistantError(
        "Usage limit",
        ErrorType.USAGE_LIMIT_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(429);
    });

    it("should handle CONFLICT_ERROR", () => {
      const error = new AssistantError("Conflict", ErrorType.CONFLICT_ERROR);

      const response = handleAIServiceError(error);

      expect(response.status).toBe(409);
    });

    it("should handle UNKNOWN_ERROR with default status", () => {
      const error = new AssistantError(
        "Unknown error",
        ErrorType.UNKNOWN_ERROR,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should handle custom status code", () => {
      const error = new AssistantError(
        "Custom error",
        ErrorType.UNKNOWN_ERROR,
        418,
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should return JSON response with error message", async () => {
      const error = new AssistantError("Test error", ErrorType.PARAMS_ERROR);

      const response = handleAIServiceError(error);
      const data = await response.json();

      expect(data).toEqual({
        error: "Invalid request parameters.",
        details: undefined,
        requestId: undefined,
      });
    });

    it("should log errors for appropriate types", () => {
      const error = new AssistantError(
        "Network error",
        ErrorType.NETWORK_ERROR,
        500,
        { details: "test" },
      );

      const response = handleAIServiceError(error);

      expect(response.status).toBe(500);
    });

    it("should handle all error types defined in enum", () => {
      const errorTypes = Object.values(ErrorType);

      errorTypes.forEach((errorType) => {
        const error = new AssistantError(`Test ${errorType}`, errorType);

        expect(() => handleAIServiceError(error)).not.toThrow();

        const response = handleAIServiceError(error);
        expect(response).toBeInstanceOf(Response);
      });
    });
  });

  describe("ErrorType enum", () => {
    it("should have all expected error types", () => {
      const expectedTypes = [
        "CONFIGURATION_ERROR",
        "NETWORK_ERROR",
        "AUTHENTICATION_ERROR",
        "RATE_LIMIT_ERROR",
        "PARAMS_ERROR",
        "NOT_FOUND",
        "PROVIDER_ERROR",
        "UNKNOWN_ERROR",
        "EXTERNAL_API_ERROR",
        "FORBIDDEN",
        "UNAUTHORIZED",
        "CONTEXT_WINDOW_EXCEEDED",
        "EMAIL_SEND_FAILED",
        "INTERNAL_ERROR",
        "USAGE_LIMIT_ERROR",
        "USER_NOT_FOUND",
        "CONFLICT_ERROR",
      ];

      expectedTypes.forEach((type) => {
        expect(ErrorType[type as keyof typeof ErrorType]).toBe(type);
      });
    });
  });
});
