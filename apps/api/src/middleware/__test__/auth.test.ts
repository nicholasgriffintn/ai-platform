import {
  INTERNAL_SERVICE_AUTHORIZATION_HEADER,
  INTERNAL_SERVICE_DELEGATION_TOKEN_AUDIENCE,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getServiceContext,
  serviceContextMiddleware,
} from "~/infrastructure/context/serviceContext";

import { allowRestrictedPaths, authMiddleware, requireAuth } from "../auth";

const mockRepositories = {
  apiKeys: {
    findApiKeyPrincipal: vi.fn(),
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
const mockTouchSession = vi.hoisted(() => vi.fn());
const mockVerifyInternalServiceToken = vi.hoisted(() => vi.fn());
const mockIsbot = vi.fn();
const repositoryCtor = vi.fn();

vi.mock("~/modules/user/infrastructure/ApiKeyRepository", () => ({
  ApiKeyRepository: class {
    constructor() {
      repositoryCtor();

      return mockRepositories.apiKeys;
    }
  },
}));

vi.mock("~/modules/user/infrastructure/UserRepository", () => ({
  UserRepository: class {
    constructor() {
      repositoryCtor();

      return mockRepositories.users;
    }
  },
}));

vi.mock("~/modules/user/infrastructure/AnonymousUserRepository", () => ({
  AnonymousUserRepository: class {
    constructor() {
      repositoryCtor();

      return mockRepositories.anonymousUsers;
    }
  },
}));

vi.mock("~/modules/auth/application/jwt", () => ({
  getUserByJwtToken: vi.fn(),
}));

vi.mock("~/modules/auth/application/internal-service", () => ({
  verifyInternalServiceToken: mockVerifyInternalServiceToken,
}));

vi.mock("~/modules/auth/application/sharedAuth", () => ({
  createAssistantAuth: vi.fn(() => ({
    authenticate: mockAuthenticateSession,
    touchSession: mockTouchSession,
  })),
}));

vi.mock("isbot", () => ({
  isbot: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-telemetry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-telemetry")>()),
  getLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  })),
}));

function createMockRequest() {
  return {
    header: vi.fn(),
    query: vi.fn(),
    json: vi.fn(),
    url: "http://example.com/test",
    path: "/test",
    method: "GET",
  };
}

function createMockContext(overrides: any = {}): Context {
  const variables = new Map<string, unknown>();
  const mockContext = {
    req: createMockRequest(),
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

function setInternalServiceAuthorization(context: Context): void {
  Object.defineProperty(context.req, "header", {
    configurable: true,
    value: (name: string) =>
      name === INTERNAL_SERVICE_AUTHORIZATION_HEADER ? "Bearer service-token" : null,
  });
}

const mockNext: Next = vi.fn();
const DAY_MS = 24 * 60 * 60 * 1000;

describe("Auth Middleware", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockRepositories.users.getUserById.mockReset();
    mockVerifyInternalServiceToken.mockReset();
    repositoryCtor.mockClear();

    const { getUserByJwtToken } = await import("~/modules/auth/application/jwt");
    const { isbot } = await import("isbot");

    vi.mocked(getUserByJwtToken).mockImplementation(mockGetUserByJwtToken);
    vi.mocked(isbot).mockImplementation(mockIsbot);

    mockIsbot.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authMiddleware", () => {
    it("uses a scoped service claim as the normal authenticated user", async () => {
      const delegatedUser = { id: 42, email: "test@example.com" };
      const context = createMockContext({
        req: { ...createMockRequest(), path: "/chat/completions", method: "POST" },
      });

      setInternalServiceAuthorization(context);
      mockVerifyInternalServiceToken.mockResolvedValue({
        aud: INTERNAL_SERVICE_DELEGATION_TOKEN_AUDIENCE,
        sub: "agent-worker",
        scopes: ["user:delegate"],
        user_id: 42,
      });
      mockRepositories.users.getUserById.mockResolvedValue(delegatedUser);

      await authMiddleware(context, mockNext);

      expect(mockRepositories.users.getUserById).toHaveBeenCalledWith(42);
      expect(context.set).toHaveBeenCalledWith("user", delegatedUser);
      expect(context.set).not.toHaveBeenCalledWith("servicePrincipal", expect.anything());
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it("rejects user delegation claims from another internal service", async () => {
      const context = createMockContext();

      setInternalServiceAuthorization(context);
      mockVerifyInternalServiceToken.mockResolvedValue({
        sub: "sandbox-worker",
        scopes: ["user:delegate"],
        user_id: 42,
      });

      await expect(authMiddleware(context, mockNext)).rejects.toThrow(
        "This internal service cannot act for a user.",
      );
      expect(mockRepositories.users.getUserById).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("rejects user delegation claims without a user id", async () => {
      const context = createMockContext();

      setInternalServiceAuthorization(context);
      mockVerifyInternalServiceToken.mockResolvedValue({
        sub: "agent-worker",
        scopes: ["user:delegate"],
      });

      await expect(authMiddleware(context, mockNext)).rejects.toThrow(
        "This internal service cannot act for a user.",
      );
      expect(mockRepositories.users.getUserById).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("leaves sandbox credential broker authentication to the broker", async () => {
      const context = createMockContext();

      context.req.path = "/internal/sandbox/credential_broker/run-123/git/info/refs";

      await authMiddleware(context, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(repositoryCtor).not.toHaveBeenCalled();
    });

    it("lets headless device sign-in clients start and poll without a browser user agent", async () => {
      mockIsbot.mockReturnValue(true);

      for (const path of ["/auth/device/code", "/auth/device/token"]) {
        const context = createMockContext();

        context.req.path = path;

        await authMiddleware(context, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(repositoryCtor).not.toHaveBeenCalled();
    });

    it("lets the desktop updater check and download releases with its own user agent", async () => {
      mockIsbot.mockReturnValue(true);

      for (const path of [
        "/desktop/releases/darwin/aarch64/0.6.0",
        "/desktop/updates/macos-universal/polychat-desktop-0.6.0-macos-universal.app.tar.gz",
      ]) {
        const context = createMockContext();

        context.req.path = path;

        await authMiddleware(context, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(repositoryCtor).not.toHaveBeenCalled();
    });

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

      expect(mockRepositories.apiKeys.findApiKeyPrincipal).not.toHaveBeenCalled();
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
      mockRepositories.apiKeys.findApiKeyPrincipal.mockResolvedValue(null);
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
      mockAuthenticateSession.mockResolvedValue({
        user: { record: mockProUser },
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
      });

      await authMiddleware(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(context.set).toHaveBeenCalledWith("user", mockProUser);
      expect(mockIsbot).not.toHaveBeenCalled();
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
      mockAuthenticateSession.mockResolvedValue({
        user: { record: mockUser },
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
      });

      await authMiddleware(context, async () => {
        await serviceContextMiddleware(context, mockNext);
      });

      expect(getServiceContext(context).requireUser()).toEqual(mockUser);
      expect(mockTouchSession).not.toHaveBeenCalled();
      expect(context.header).not.toHaveBeenCalled();
    });

    it("extends a session in use once a day so active people stay signed in", async () => {
      const mockUser = { id: 123, email: "test@example.com" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "Cookie") {
          return "session=session-123";
        }

        return null;
      });
      mockAuthenticateSession.mockResolvedValue({
        user: { record: mockUser },
        expiresAt: new Date(Date.now() + 5 * DAY_MS),
      });
      mockTouchSession.mockResolvedValue({
        user: { record: mockUser },
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
      });

      await authMiddleware(context, mockNext);

      expect(mockTouchSession).toHaveBeenCalledWith("session-123");
      expect(context.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("session=session-123;"),
        { append: true },
      );
      expect(context.get("user")).toEqual(mockUser);
    });

    it("keeps the person signed in when renewing their session fails", async () => {
      const mockUser = { id: 123, email: "test@example.com" };
      const context = createMockContext();

      // @ts-expect-error - mock implementation
      context.req.header.mockImplementation((name: string) => {
        if (name === "user-agent") {
          return "Mozilla/5.0";
        }

        if (name === "Cookie") {
          return "session=session-123";
        }

        return null;
      });
      mockAuthenticateSession.mockResolvedValue({
        user: { record: mockUser },
        expiresAt: new Date(Date.now() + DAY_MS),
      });
      mockTouchSession.mockRejectedValue(new Error("database unavailable"));

      await authMiddleware(context, mockNext);

      expect(context.header).not.toHaveBeenCalled();
      expect(context.get("user")).toEqual(mockUser);
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

      mockRepositories.apiKeys.findApiKeyPrincipal.mockResolvedValue({
        user: mockUser,
        scope: "full",
      });

      await authMiddleware(context, mockNext);

      expect(mockRepositories.apiKeys.findApiKeyPrincipal).toHaveBeenCalledWith("ak_test123");
      expect(context.set).toHaveBeenCalledWith("user", mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsbot).not.toHaveBeenCalled();
    });

    it("authenticates a Discover key only on Discover routes", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const authenticate = async (method: string, path: string) => {
        const context = createMockContext();

        Object.assign(context.req, { method, path });
        // @ts-expect-error - mock implementation
        context.req.header.mockImplementation((name: string) =>
          name === "user-agent" ? "Mozilla/5.0" : name === "Authorization" ? "Bearer ak_tv" : null,
        );
        mockRepositories.apiKeys.findApiKeyPrincipal.mockResolvedValue({
          user: mockUser,
          scope: "discover",
        });
        mockRepositories.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(null);

        await authMiddleware(context, mockNext);

        return context.get("user");
      };

      expect(await authenticate("POST", "/discover/wind-down")).toEqual(mockUser);
      expect(await authenticate("GET", "/sources/source-1/cover")).toEqual(mockUser);
      expect(await authenticate("GET", "/conversations")).toBeNull();
      expect(await authenticate("GET", "/sources/source-1/content")).toBeNull();
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

      mockRepositories.apiKeys.findApiKeyPrincipal.mockRejectedValue(new Error("Database error"));

      await authMiddleware(context, mockNext);

      expect(context.set).toHaveBeenCalledWith("user", null);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("requireAuth", () => {
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
    it("should allow non-pro users access to generate title endpoint", async () => {
      const context = createMockContext({
        req: {
          ...createMockRequest(),
          path: "/conversations/123/title",
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
            ...createMockRequest(),
            path: "/conversations/conversation-1/goal",
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
          ...createMockRequest(),
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

    it("lets non-pro users send managed and builtin tool selections on /responses", async () => {
      const context = createMockContext({
        req: {
          ...createMockRequest(),
          path: "/responses",
          method: "POST",
          json: vi.fn().mockResolvedValue({
            tools: [{ type: "managed" }, { type: "builtin", id: "web_search" }],
          }),
        },
      });

      // @ts-expect-error - mock implementation
      context.get.mockImplementation((key: string) => (key === "user" ? { id: 7 } : null));

      await allowRestrictedPaths(context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should block unauthorized paths for non-pro users", async () => {
      const context = createMockContext({
        req: {
          ...createMockRequest(),
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
