import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

function createMockContext(overrides: any = {}): Context {
  const mockContext = {
    req: {
      method: "GET",
      url: "http://example.com/test",
      header: vi.fn(),
    },
    res: {
      status: 200,
      headers: new Headers(),
    },
    get: vi.fn(),
    set: vi.fn(),
    ...overrides,
  } as any;

  return mockContext;
}

const mockNext: Next = vi.fn();

describe("Logger Middleware", () => {
  let mockLogger: any;
  let loggerMiddleware: any;
  let createRouteLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.resetModules();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    const { getLogger } = await import("~/utils/logger");
    vi.mocked(getLogger).mockReturnValue(mockLogger);

    const middlewareModule = await import("../loggerMiddleware");
    loggerMiddleware = middlewareModule.loggerMiddleware;
    createRouteLogger = middlewareModule.createRouteLogger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("loggerMiddleware", () => {
    it("should log request start and completion", async () => {
      const context = createMockContext();
      const mockUser = { id: "user-123" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") return mockUser;
        return null;
      });

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") return "Mozilla/5.0";
        return null;
      });

      const startTime = Date.now();
      vi.setSystemTime(startTime);

      const middlewarePromise = loggerMiddleware(context, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Request started: GET http://example.com/test",
        {
          method: "GET",
          url: "http://example.com/test",
          userId: "user-123",
        },
      );

      vi.setSystemTime(startTime + 100);
      await middlewarePromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Request completed: GET http://example.com/test",
        {
          method: "GET",
          url: "http://example.com/test",
          status: 200,
          duration: "0.1s",
          userId: "user-123",
        },
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("should log without user ID when no user present", async () => {
      const context = createMockContext();
      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") return "Mozilla/5.0";
        return null;
      });

      await loggerMiddleware(context, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Request started: GET http://example.com/test",
        {
          method: "GET",
          url: "http://example.com/test",
          userId: undefined,
        },
      );
    });

    it("should log errors when middleware throws", async () => {
      const context = createMockContext();
      const mockUser = { id: "user-123" };
      const error = new Error("Test error");

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") return mockUser;
        return null;
      });

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") return "Mozilla/5.0";
        return null;
      });

      // @ts-expect-error - mock implementation
      mockNext.mockRejectedValue(error);

      const startTime = Date.now();
      vi.setSystemTime(startTime);

      const middlewarePromise = loggerMiddleware(context, mockNext);

      vi.setSystemTime(startTime + 50);

      await expect(middlewarePromise).rejects.toThrow("Test error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Request failed: GET http://example.com/test",
        {
          method: "GET",
          url: "http://example.com/test",
          error: "Test error",
          duration: "0.05s",
          userId: "user-123",
          userAgent: "Mozilla/5.0",
          stack: expect.any(String),
        },
      );
    });

    it("should handle non-Error objects thrown by middleware", async () => {
      const context = createMockContext();
      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") return "Mozilla/5.0";
        return null;
      });

      const nonErrorValue = "String error";
      // @ts-expect-error - mock implementation
      mockNext.mockRejectedValue(nonErrorValue);

      await expect(loggerMiddleware(context, mockNext)).rejects.toBe(
        nonErrorValue,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Request failed: GET http://example.com/test",
        expect.objectContaining({
          error: "String error",
          stack: "No stack trace",
        }),
      );
    });

    it("should handle unknown user agent", async () => {
      const context = createMockContext();
      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") return null;
        return null;
      });

      const error = new Error("Test error");
      // @ts-expect-error - mock implementation
      mockNext.mockRejectedValue(error);

      await expect(loggerMiddleware(context, mockNext)).rejects.toThrow(
        "Test error",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Request failed: GET http://example.com/test",
        expect.objectContaining({
          userAgent: "unknown",
        }),
      );
    });

    it("should handle different HTTP methods", async () => {
      const context = createMockContext({
        req: {
          method: "POST",
          url: "http://example.com/api/users",
          header: vi.fn(),
        },
      });

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);
      // @ts-expect-error - mock implementation
      context.req.header.mockReturnValue("Mozilla/5.0");

      await loggerMiddleware(context, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Request started: POST http://example.com/api/users",
        expect.objectContaining({
          method: "POST",
          url: "http://example.com/api/users",
        }),
      );
    });

    it("should handle different response status codes", async () => {
      const context = createMockContext({
        res: {
          status: 404,
        },
      });

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);
      // @ts-expect-error - mock implementation
      context.req.header.mockReturnValue("Mozilla/5.0");

      await loggerMiddleware(context, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Request completed with client error: GET http://example.com/test",
        expect.objectContaining({
          status: 404,
        }),
      );
    });

    it("should measure request duration accurately", async () => {
      const context = createMockContext();
      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);
      // @ts-expect-error - mock implementation
      context.req.header.mockReturnValue("Mozilla/5.0");

      const startTime = Date.now();
      vi.setSystemTime(startTime);

      const middlewarePromise = loggerMiddleware(context, mockNext);

      vi.setSystemTime(startTime + 250);
      await middlewarePromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Request completed: GET http://example.com/test",
        expect.objectContaining({
          duration: "0.25s",
        }),
      );
    });
  });

  describe("createRouteLogger", () => {
    it("should create logger with specified route prefix", async () => {
      const { getLogger } = await import("~/utils/logger");

      const routeLogger = createRouteLogger("AUTH");

      expect(vi.mocked(getLogger)).toHaveBeenCalledWith({ prefix: "AUTH" });
      expect(routeLogger).toEqual(
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        }),
      );
    });

    it("should create logger with different route prefixes", async () => {
      const { getLogger } = await import("~/utils/logger");

      createRouteLogger("USERS");
      createRouteLogger("CHAT");

      expect(vi.mocked(getLogger)).toHaveBeenCalledWith({ prefix: "USERS" });
      expect(vi.mocked(getLogger)).toHaveBeenCalledWith({ prefix: "CHAT" });
    });

    it("should handle empty route name", async () => {
      const { getLogger } = await import("~/utils/logger");

      createRouteLogger("");

      expect(vi.mocked(getLogger)).toHaveBeenCalledWith({ prefix: "" });
    });
  });
});
