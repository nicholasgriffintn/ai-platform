import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServiceContext, serviceContextMiddleware } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { allowRestrictedPaths, authMiddleware, requireAuth } from "../auth";

const mockRepositories = {
  apiKeys: {
    findUserIdByApiKey: vi.fn(),
  },
  users: {
    getUserById: vi.fn(),
  },
  anonymousUsers: {
    getAnonymousUserById: vi.fn(),
    getOrCreateAnonymousUser: vi.fn(),
  },
};

const mockGetUserByJwtToken = vi.fn();
const mockAuthenticateSession = vi.hoisted(() => vi.fn());
const mockIsbot = vi.fn();
const repositoryCtor = vi.fn();
let repositoryFactory = () => mockRepositories;

vi.mock("~/repositories", () => ({
  RepositoryManager: class {
    constructor() {
      repositoryCtor();

      return repositoryFactory();
    }
  },
}));

vi.mock("~/lib/cache", () => ({
  KVCache: class MockKVCache {
    static createKey = vi.fn();
    get = vi.fn();
    set = vi.fn();
  },
}));

vi.mock("~/services/auth/jwt", () => ({
  getUserByJwtToken: vi.fn(),
}));

vi.mock("~/services/auth/sharedAuth", () => ({
  createAssistantAuth: vi.fn(() => ({
    authenticate: mockAuthenticateSession,
  })),
}));

vi.mock("isbot", () => ({
  isbot: vi.fn(),
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  })),
}));

function createMockContext(overrides: any = {}): Context {
  const variables = new Map<string, unknown>();
  const mockContext = {
    req: {
      header: vi.fn(),
      query: vi.fn(),
      json: vi.fn(),
      url: "http://example.com/test",
      path: "/test",
      method: "GET",
    },
    env: {
      DB: {} as any,
      CACHE: null,
      JWT_SECRET: "test-secret",
      ...overrides.env,
    },
    get: vi.fn((key: string) => variables.get(key)),
    set: vi.fn((key: string, value: unknown) => variables.set(key, value)),
    header: vi.fn(),
    ...overrides,
  };

  return mockContext;
}

const mockNext: Next = vi.fn();

describe("Auth Middleware", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    repositoryCtor.mockClear();

    const { KVCache } = await import("~/lib/cache");
    const { getUserByJwtToken } = await import("~/services/auth/jwt");
    const { isbot } = await import("isbot");

    repositoryFactory = () => mockRepositories;
    vi.mocked(KVCache.createKey).mockReturnValue("bot:user-agent");
    vi.mocked(getUserByJwtToken).mockImplementation(mockGetUserByJwtToken);
    vi.mocked(isbot).mockImplementation(mockIsbot);

    mockIsbot.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authMiddleware", () => {
    it("should block unknown user agents", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "unknown";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        return null;
      });

      await expect(authMiddleware(context, mockNext)).rejects.toThrow("Bot access is not allowed.");

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should block non-pro bots", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Googlebot";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        return null;
      });
      mockIsbot.mockReturnValue(true);

      await expect(authMiddleware(context, mockNext)).rejects.toThrow("Bot access is not allowed.");

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockIsbot).toHaveBeenCalled();
    });

    it("should not let unverified URL credentials bypass bot detection", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.query.mockImplementation((name: string) =>
        name === "token" ? "ak_unverified" : undefined,
      );
      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Googlebot";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        return null;
      });
      mockIsbot.mockReturnValue(true);

      await expect(authMiddleware(context, mockNext)).rejects.toThrow("Bot access is not allowed.");

      expect(mockRepositories.apiKeys.findUserIdByApiKey).not.toHaveBeenCalled();
      expect(mockIsbot).toHaveBeenCalledWith("Googlebot");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should not let invalid bearer credentials bypass bot detection", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Googlebot";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Authorization") {
          return "Bearer ak_invalid";
        }

        return null;
      });
      mockRepositories.apiKeys.findUserIdByApiKey.mockResolvedValue(null);
      mockIsbot.mockReturnValue(true);

      await expect(authMiddleware(context, mockNext)).rejects.toThrow("Bot access is not allowed.");

      expect(mockIsbot).toHaveBeenCalledWith("Googlebot");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow native mobile app user agents that are not classified as bots", async () => {
      const mockAnonymousUser = { id: "anon-123", ip_address: "127.0.0.1" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Polychat/1.0 CFNetwork Darwin";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        return null;
      });
      mockRepositories.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(mockAnonymousUser);

      await authMiddleware(context, mockNext);

      expect(mockIsbot).toHaveBeenCalledWith("Polychat/1.0 CFNetwork Darwin");
      expect(context.set).toHaveBeenCalledWith("anonymousUser", mockAnonymousUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow pro user bots", async () => {
      const mockProUser = {
        id: "user-123",
        email: "test@example.com",
        plan_id: "pro",
      };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Googlebot";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Cookie") {
          return "session=session-123";
        }

        return null;
      });
      mockIsbot.mockReturnValue(true);
      mockAuthenticateSession.mockResolvedValue({ user: { record: mockProUser } });

      await authMiddleware(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(context.set).toHaveBeenCalledWith("user", mockProUser);
      expect(mockIsbot).not.toHaveBeenCalled();
    });

    it("should authenticate user with session ID", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Cookie") {
          return "session=session-123";
        }

        return null;
      });

      mockAuthenticateSession.mockResolvedValue({ user: { record: mockUser } });

      await authMiddleware(context, mockNext);

      expect(mockAuthenticateSession).toHaveBeenCalledWith("session-123");
      expect(context.set).toHaveBeenCalledWith("user", mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it("makes the session user available to downstream services", async () => {
      const mockUser = { id: 123, email: "test@example.com" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Cookie") {
          return "session=session-123";
        }

        return null;
      });
      mockAuthenticateSession.mockResolvedValue({ user: { record: mockUser } });

      await authMiddleware(context, async () => {
        await serviceContextMiddleware(context, mockNext);
      });

      expect(getServiceContext(context).requireUser()).toEqual(mockUser);
    });

    it("should authenticate user with API key", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Authorization") {
          return "Bearer ak_test123";
        }

        return null;
      });

      mockRepositories.apiKeys.findUserIdByApiKey.mockResolvedValue("user-123");
      mockRepositories.users.getUserById.mockResolvedValue(mockUser);

      await authMiddleware(context, mockNext);

      expect(mockRepositories.apiKeys.findUserIdByApiKey).toHaveBeenCalledWith("ak_test123");
      expect(mockRepositories.users.getUserById).toHaveBeenCalledWith("user-123");
      expect(context.set).toHaveBeenCalledWith("user", mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsbot).not.toHaveBeenCalled();
    });

    it("should authenticate user with JWT token", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Authorization") {
          return "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.test";
        }

        return null;
      });

      mockGetUserByJwtToken.mockResolvedValue(mockUser);

      await authMiddleware(context, mockNext);

      expect(mockGetUserByJwtToken).toHaveBeenCalled();
      expect(context.set).toHaveBeenCalledWith("user", mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsbot).not.toHaveBeenCalled();
      expect(repositoryCtor).not.toHaveBeenCalled();
    });

    it("should create anonymous user when no authentication found", async () => {
      const mockAnonymousUser = { id: "anon-123", ip_address: "127.0.0.1" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        return null;
      });

      mockRepositories.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(mockAnonymousUser);

      await authMiddleware(context, mockNext);

      expect(mockRepositories.anonymousUsers.getOrCreateAnonymousUser).toHaveBeenCalledWith(
        "127.0.0.1",
        "Mozilla/5.0",
      );
      expect(context.set).toHaveBeenCalledWith("anonymousUser", mockAnonymousUser);
      expect(context.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("anon_id=anon-123"),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle existing anonymous user from cookie", async () => {
      const mockAnonymousUser = { id: "anon-123", ip_address: "127.0.0.1" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Cookie") {
          return "anon_id=anon-123";
        }

        return null;
      });

      mockRepositories.anonymousUsers.getAnonymousUserById.mockResolvedValue(mockAnonymousUser);

      await authMiddleware(context, mockNext);

      expect(mockRepositories.anonymousUsers.getAnonymousUserById).toHaveBeenCalledWith("anon-123");
      expect(context.set).toHaveBeenCalledWith("anonymousUser", mockAnonymousUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle authentication errors gracefully", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "CF-Connecting-IP") {
          return "127.0.0.1";
        }

        if (name === "Authorization") {
          return "Bearer ak_invalid";
        }

        return null;
      });

      mockRepositories.apiKeys.findUserIdByApiKey.mockRejectedValue(new Error("Database error"));

      await authMiddleware(context, mockNext);

      expect(context.set).toHaveBeenCalledWith("user", null);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("requireAuth", () => {
    it("should allow authenticated user", async () => {
      const context = createMockContext();
      const mockUser = { id: "user-123" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      await requireAuth(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow anonymous user", async () => {
      const context = createMockContext();
      const mockAnonymousUser = { id: "anon-123" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "anonymousUser") {
          return mockAnonymousUser;
        }

        return null;
      });

      await requireAuth(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should throw error when no user or anonymous user", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      await expect(requireAuth(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(requireAuth(context, mockNext)).rejects.toThrow(
        "This endpoint requires authentication",
      );
    });
  });

  describe("allowRestrictedPaths", () => {
    it("should allow pro users unrestricted access", async () => {
      const context = createMockContext();
      const mockUser = { id: "user-123", plan_id: "pro" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      await allowRestrictedPaths(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow non-pro users access to generate title endpoint", async () => {
      const context = createMockContext({
        req: {
          ...createMockContext().req,
          path: "/chat/completions/123/generate-title",
          method: "POST",
        },
      });
      const mockUser = { id: "user-123", plan_id: "free" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      await allowRestrictedPaths(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("lets non-pro users reach the goal routes so the plan gate answers, not this one", async () => {
      for (const method of ["GET", "POST", "PATCH"]) {
        (mockNext as unknown as { mockClear: () => void }).mockClear();

        const context = createMockContext({
          req: {
            ...createMockContext().req,
            path: "/chat/completions/conversation-1/goal",
            method,
          },
        });

        // @ts-expect-error - mock implementation
        context.get.mockImplementation((key: string) => {
          if (key === "user") {
            return { id: "user-123", plan_id: "free" };
          }

          return null;
        });

        await allowRestrictedPaths(context, mockNext);

        expect(mockNext).toHaveBeenCalled();
      }
    });

    it("should block tool usage for unauthenticated users", async () => {
      const context = createMockContext({
        req: {
          ...createMockContext().req,
          path: "/chat/completions",
          method: "POST",
          json: vi.fn().mockResolvedValue({ tools: [{ type: "function" }] }),
        },
      });
      const mockAnonymousUser = { id: "anon-123" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "anonymousUser") {
          return mockAnonymousUser;
        }

        if (key === "user") {
          return null;
        }

        return null;
      });

      await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
        "Tool usage requires authentication",
      );
    });

    it("should throw error when no user data for restricted access", async () => {
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.get.mockReturnValue(null);

      await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
        "User usage tracking required",
      );
    });

    it("should block unauthorized paths for non-pro users", async () => {
      const context = createMockContext({
        req: {
          ...createMockContext().req,
          path: "/restricted-endpoint",
          method: "GET",
        },
      });
      const mockUser = { id: "user-123", plan_id: "free" };

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => {
        if (key === "user") {
          return mockUser;
        }

        return null;
      });

      await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(AssistantError);
      await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
        "This endpoint requires authentication",
      );
    });
  });
});
