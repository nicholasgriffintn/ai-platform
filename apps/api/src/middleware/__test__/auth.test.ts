import { INTERNAL_SERVICE_AUTHORIZATION_HEADER } from "@ngriffin_uk/polychat-schemas";
import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authMiddleware } from "../auth";

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

const mockAuthenticateSession = vi.hoisted(() => vi.fn());
const mockVerifyInternalServiceToken = vi.hoisted(() => vi.fn());
const mockIsbot = vi.fn();

vi.mock("~/modules/user/infrastructure/ApiKeyRepository", () => ({
  ApiKeyRepository: class {
    constructor() {
      return mockRepositories.apiKeys;
    }
  },
}));

vi.mock("~/modules/user/infrastructure/UserRepository", () => ({
  UserRepository: class {
    constructor() {
      return mockRepositories.users;
    }
  },
}));

vi.mock("~/modules/user/infrastructure/AnonymousUserRepository", () => ({
  AnonymousUserRepository: class {
    constructor() {
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
    touchSession: vi.fn(),
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

describe("Auth Middleware", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockRepositories.users.getUserById.mockReset();
    mockVerifyInternalServiceToken.mockReset();

    const { isbot } = await import("isbot");

    vi.mocked(isbot).mockImplementation(mockIsbot);

    mockIsbot.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authMiddleware", () => {
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

    it("authenticates a Pashi key only for model calls and its own link", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const authenticate = async (method: string, path: string) => {
        const context = createMockContext();

        Object.assign(context.req, { method, path });
        // @ts-expect-error - mock implementation
        context.req.header.mockImplementation((name: string) =>
          name === "user-agent" ? "Mozilla/5.0" : name === "Authorization" ? "Bearer ak_app" : null,
        );
        mockRepositories.apiKeys.findApiKeyPrincipal.mockResolvedValue({
          user: mockUser,
          scope: "pashi",
        });
        mockRepositories.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(null);

        await authMiddleware(context, mockNext);

        return { scope: context.get("credentialScope"), user: context.get("user") };
      };

      expect(await authenticate("POST", "/chat/completions")).toEqual({
        scope: "pashi",
        user: mockUser,
      });
      expect((await authenticate("PUT", "/pashi/link")).user).toEqual(mockUser);
      expect((await authenticate("GET", "/chat/completions")).user).toBeNull();
      expect((await authenticate("POST", "/responses")).user).toBeNull();
      expect((await authenticate("GET", "/conversations")).user).toBeNull();
      expect((await authenticate("GET", "/auth/me")).user).toBeNull();
      expect((await authenticate("GET", "/api_keys")).user).toBeNull();
    });
  });
});
