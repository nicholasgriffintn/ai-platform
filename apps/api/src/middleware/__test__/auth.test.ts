import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const mockGetUserBySessionId = vi.fn();
const mockIsbot = vi.fn();
let RepositoryManagerMock: any;

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
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

vi.mock("~/services/auth/user", () => ({
	getUserBySessionId: vi.fn(),
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
		get: vi.fn(),
		set: vi.fn(),
		header: vi.fn(),
		...overrides,
	} as any;

	return mockContext;
}

const mockNext: Next = vi.fn();

describe("Auth Middleware", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		const { RepositoryManager } = await import("~/repositories");
		const { KVCache } = await import("~/lib/cache");
		const { getUserByJwtToken } = await import("~/services/auth/jwt");
		const { getUserBySessionId } = await import("~/services/auth/user");
		const { isbot } = await import("isbot");

		RepositoryManagerMock = vi.mocked(RepositoryManager);
		RepositoryManagerMock.mockImplementation(() => mockRepositories as any);
		vi.mocked(KVCache.createKey).mockReturnValue("bot:user-agent");
		vi.mocked(getUserByJwtToken).mockImplementation(mockGetUserByJwtToken);
		vi.mocked(getUserBySessionId).mockImplementation(mockGetUserBySessionId);
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
				if (name === "user-agent") return "unknown";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				return null;
			});

			await expect(authMiddleware(context, mockNext)).rejects.toThrow(
				"Bot access is not allowed.",
			);

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should block non-pro bots", async () => {
			const context = createMockContext();
			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "user-agent") return "Googlebot";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				return null;
			});
			mockIsbot.mockReturnValue(true);

			await expect(authMiddleware(context, mockNext)).rejects.toThrow(
				"Bot access is not allowed.",
			);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockIsbot).toHaveBeenCalled();
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
				if (name === "user-agent") return "Googlebot";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				if (name === "Cookie") return "session=session-123";
				return null;
			});
			mockIsbot.mockReturnValue(true);
			mockGetUserBySessionId.mockResolvedValue(mockProUser);

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
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				if (name === "Cookie") return "session=session-123";
				return null;
			});

			mockGetUserBySessionId.mockResolvedValue(mockUser);

			await authMiddleware(context, mockNext);

			expect(mockGetUserBySessionId).toHaveBeenCalledWith(
				mockRepositories,
				"session-123",
			);
			expect(context.set).toHaveBeenCalledWith("user", mockUser);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should authenticate user with API key", async () => {
			const mockUser = { id: "user-123", email: "test@example.com" };
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				if (name === "Authorization") return "Bearer ak_test123";
				return null;
			});

			mockRepositories.apiKeys.findUserIdByApiKey.mockResolvedValue("user-123");
			mockRepositories.users.getUserById.mockResolvedValue(mockUser);

			await authMiddleware(context, mockNext);

			expect(mockRepositories.apiKeys.findUserIdByApiKey).toHaveBeenCalledWith(
				"ak_test123",
			);
			expect(mockRepositories.users.getUserById).toHaveBeenCalledWith(
				"user-123",
			);
			expect(context.set).toHaveBeenCalledWith("user", mockUser);
			expect(mockNext).toHaveBeenCalled();
			expect(mockIsbot).not.toHaveBeenCalled();
		});

		it("should authenticate user with JWT token", async () => {
			const mockUser = { id: "user-123", email: "test@example.com" };
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				if (name === "Authorization")
					return "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.test";
				return null;
			});

			mockGetUserByJwtToken.mockResolvedValue(mockUser);

			await authMiddleware(context, mockNext);

			expect(mockGetUserByJwtToken).toHaveBeenCalled();
			expect(context.set).toHaveBeenCalledWith("user", mockUser);
			expect(mockNext).toHaveBeenCalled();
			expect(mockIsbot).not.toHaveBeenCalled();
			expect(RepositoryManagerMock).not.toHaveBeenCalled();
		});

		it("should create anonymous user when no authentication found", async () => {
			const mockAnonymousUser = { id: "anon-123", ip_address: "127.0.0.1" };
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				return null;
			});

			mockRepositories.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(
				mockAnonymousUser,
			);

			await authMiddleware(context, mockNext);

			expect(
				mockRepositories.anonymousUsers.getOrCreateAnonymousUser,
			).toHaveBeenCalledWith("127.0.0.1", "Mozilla/5.0");
			expect(context.set).toHaveBeenCalledWith(
				"anonymousUser",
				mockAnonymousUser,
			);
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
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				if (name === "Cookie") return "anon_id=anon-123";
				return null;
			});

			mockRepositories.anonymousUsers.getAnonymousUserById.mockResolvedValue(
				mockAnonymousUser,
			);

			await authMiddleware(context, mockNext);

			expect(
				mockRepositories.anonymousUsers.getAnonymousUserById,
			).toHaveBeenCalledWith("anon-123");
			expect(context.set).toHaveBeenCalledWith(
				"anonymousUser",
				mockAnonymousUser,
			);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should handle authentication errors gracefully", async () => {
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "CF-Connecting-IP") return "127.0.0.1";
				if (name === "Authorization") return "Bearer ak_invalid";
				return null;
			});

			mockRepositories.apiKeys.findUserIdByApiKey.mockRejectedValue(
				new Error("Database error"),
			);

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
				if (key === "user") return mockUser;
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
				if (key === "anonymousUser") return mockAnonymousUser;
				return null;
			});

			await requireAuth(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should throw error when no user or anonymous user", async () => {
			const context = createMockContext();
			// @ts-expect-error - mock implementation
			context.get.mockReturnValue(null);

			await expect(requireAuth(context, mockNext)).rejects.toThrow(
				AssistantError,
			);
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
				if (key === "user") return mockUser;
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
				if (key === "user") return mockUser;
				return null;
			});

			await allowRestrictedPaths(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should block RAG usage for unauthenticated users", async () => {
			const context = createMockContext({
				req: {
					...createMockContext().req,
					path: "/chat/completions",
					method: "POST",
					json: vi.fn().mockResolvedValue({ use_rag: true }),
				},
			});
			const mockAnonymousUser = { id: "anon-123" };
			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "anonymousUser") return mockAnonymousUser;
				if (key === "user") return null;
				return null;
			});

			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				AssistantError,
			);
			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				"RAG features require authentication",
			);
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
				if (key === "anonymousUser") return mockAnonymousUser;
				if (key === "user") return null;
				return null;
			});

			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				AssistantError,
			);
			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				"Tool usage requires authentication",
			);
		});

		it("should throw error when no user data for restricted access", async () => {
			const context = createMockContext();
			// @ts-expect-error - mock implementation
			context.get.mockReturnValue(null);

			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				AssistantError,
			);
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
				if (key === "user") return mockUser;
				return null;
			});

			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				AssistantError,
			);
			await expect(allowRestrictedPaths(context, mockNext)).rejects.toThrow(
				"This endpoint requires authentication",
			);
		});
	});
});
