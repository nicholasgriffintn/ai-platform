import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { rateLimit } from "../rateLimit";

const mockTrackUsageMetric = vi.fn();

vi.mock("~/lib/monitoring", () => ({
  trackUsageMetric: vi.fn(),
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

function createMockContext(overrides: any = {}): Context {
  const mockContext = {
    req: {
      url: "http://example.com/chat/completions",
      path: "/chat/completions",
      header: vi.fn().mockReturnValue(undefined),
    },
    env: {
      FREE_RATE_LIMITER: {
        limit: vi.fn(),
      },
      PRO_RATE_LIMITER: {
        limit: vi.fn(),
      },
      ANALYTICS: {},
      ...overrides.env,
    },
    get: vi.fn(),
    ...overrides,
  };

  return mockContext;
}

const mockNext: Next = vi.fn();

describe("Rate Limit Middleware", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { trackUsageMetric } = await import("~/lib/monitoring");

    vi.mocked(trackUsageMetric).mockImplementation(mockTrackUsageMetric);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rateLimit", () => {
    it("should throw error when rate limiters not configured", async () => {
      const context = createMockContext({
        env: {
          FREE_RATE_LIMITER: null,
          PRO_RATE_LIMITER: null,
        },
      });

      await expect(rateLimit(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(rateLimit(context, mockNext)).rejects.toThrow("Rate limiter not configured");
    });

    it("should use PRO_RATE_LIMITER for authenticated users", async () => {
      const mockUser = { id: "user-123" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      context.env.PRO_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      expect(context.env.PRO_RATE_LIMITER.limit).toHaveBeenCalledWith({
        key: "authenticated-user-123",
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should use FREE_RATE_LIMITER for unauthenticated users", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      context.env.FREE_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      expect(context.env.FREE_RATE_LIMITER.limit).toHaveBeenCalledWith({
        key: "unauthenticated-unknown",
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should rate limit credential broker grants without treating them as user credentials", async () => {
      const requestHeader = vi.fn((name: string) => {
        if (name === "Authorization") {
          return "Bearer scoped-broker-grant";
        }

        return name === "CF-Connecting-IP" ? "203.0.113.10" : undefined;
      });
      const getContextVariable = vi.fn().mockReturnValue(null);
      const context = createMockContext({
        req: {
          url: "http://example.com/apps/sandbox/credential-broker/run-123/git/info/refs",
          path: "/apps/sandbox/credential-broker/run-123/git/info/refs",
          header: requestHeader,
        },
        get: getContextVariable,
      });

      context.env.PRO_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      expect(context.env.PRO_RATE_LIMITER.limit).toHaveBeenCalledWith({
        key: "sandbox-broker-203.0.113.10",
      });
      expect(context.env.FREE_RATE_LIMITER.limit).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("does not let rotating broker grants evade the source rate limit", async () => {
      const context = createMockContext({
        req: {
          url: "http://example.com/apps/sandbox/credential-broker/run-123/git/info/refs",
          path: "/apps/sandbox/credential-broker/run-123/git/info/refs",
          header: vi.fn((name: string) =>
            name === "CF-Connecting-IP" ? "203.0.113.10" : "Bearer another-grant",
          ),
        },
        get: vi.fn().mockReturnValue(null),
      });

      context.env.PRO_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      expect(context.env.PRO_RATE_LIMITER.limit).toHaveBeenCalledWith({
        key: "sandbox-broker-203.0.113.10",
      });
    });

    it("should throw rate limit error for authenticated users when limit exceeded", async () => {
      const mockUser = { id: "user-123" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      context.env.PRO_RATE_LIMITER.limit.mockResolvedValue({ success: false });

      await expect(rateLimit(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(rateLimit(context, mockNext)).rejects.toThrow(
        "Rate limit exceeded: 100 requests per minute",
      );

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw rate limit error for unauthenticated users when limit exceeded", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      context.env.FREE_RATE_LIMITER.limit.mockResolvedValue({ success: false });

      await expect(rateLimit(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(rateLimit(context, mockNext)).rejects.toThrow(
        "Rate limit exceeded: 10 requests per minute. Please authenticate for higher limits.",
      );

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should track usage metrics for authenticated users", async () => {
      const mockUser = { id: "user-123" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      context.env.PRO_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockTrackUsageMetric).toHaveBeenCalledWith(
        "user-123",
        "completions",
        context.env.ANALYTICS,
      );
    });

    it("should track usage metrics for unauthenticated users", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      context.env.FREE_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockTrackUsageMetric).toHaveBeenCalledWith(
        undefined,
        "completions",
        context.env.ANALYTICS,
      );
    });

    it("uses one identity bucket across paths so dynamic IDs cannot evade limits", async () => {
      const context = createMockContext({
        req: {
          url: "http://example.com/chat/audio/speech",
          path: "/chat/audio/speech",
          header: vi.fn().mockReturnValue("203.0.113.10"),
        },
      });

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      context.env.FREE_RATE_LIMITER.limit.mockResolvedValue({ success: true });

      await rateLimit(context, mockNext);

      expect(context.env.FREE_RATE_LIMITER.limit).toHaveBeenCalledWith({
        key: "unauthenticated-203.0.113.10",
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockTrackUsageMetric).toHaveBeenCalledWith(undefined, "speech", context.env.ANALYTICS);
    });

    it("should handle usage metric tracking errors gracefully", async () => {
      const mockUser = { id: "user-123" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      context.env.PRO_RATE_LIMITER.limit.mockResolvedValue({ success: true });
      mockTrackUsageMetric.mockRejectedValue(new Error("Analytics error"));

      await rateLimit(context, mockNext);

      expect(mockNext).toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockTrackUsageMetric).toHaveBeenCalled();
    });
  });
});
