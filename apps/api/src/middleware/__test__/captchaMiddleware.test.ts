import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateCaptcha } from "../captchaMiddleware";

const mockVerifyCaptchaToken = vi.fn();
const mockRepositoryManager = {
	anonymousUsers: {
		updateAnonymousUser: vi.fn(),
		getOrCreateAnonymousUser: vi.fn(),
	},
};

vi.mock("~/lib/captcha", () => ({
	verifyCaptchaToken: vi.fn(),
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		debug: vi.fn(),
		error: vi.fn(),
	})),
}));

function createMockContext(overrides: any = {}): Context {
	const mockContext = {
		req: {
			header: vi.fn(),
		},
		env: {
			REQUIRE_CAPTCHA_SECRET_KEY: "true",
			HCAPTCHA_SECRET_KEY: "secret-key",
			HCAPTCHA_SITE_KEY: "site-key",
			...overrides.env,
		},
		get: vi.fn(),
		set: vi.fn(),
		json: vi.fn(),
		...overrides,
	} as any;

	return mockContext;
}

const mockNext: Next = vi.fn();

describe("Captcha Middleware", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		const { verifyCaptchaToken } = await import("~/lib/captcha");
		const { RepositoryManager } = await import("~/repositories");

		vi.mocked(verifyCaptchaToken).mockImplementation(mockVerifyCaptchaToken);
		vi.mocked(RepositoryManager.getInstance).mockReturnValue(
			mockRepositoryManager as any,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("validateCaptcha", () => {
		it("should skip captcha verification for authenticated users", async () => {
			const context = createMockContext();
			const mockUser = { id: "user-123" };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return mockUser;
				return null;
			});

			await validateCaptcha(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockVerifyCaptchaToken).not.toHaveBeenCalled();
		});

		it("should skip captcha verification when captcha is disabled", async () => {
			const context = createMockContext({
				env: { REQUIRE_CAPTCHA_SECRET_KEY: undefined },
			});

			// @ts-expect-error - mock implementation
			context.get.mockReturnValue(null);

			await validateCaptcha(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockVerifyCaptchaToken).not.toHaveBeenCalled();
		});

		it("should skip captcha verification when environment variables are missing", async () => {
			const context = createMockContext({
				env: {
					REQUIRE_CAPTCHA_SECRET_KEY: "true",
					HCAPTCHA_SECRET_KEY: undefined,
					HCAPTCHA_SITE_KEY: undefined,
				},
			});

			// @ts-expect-error - mock implementation
			context.get.mockReturnValue(null);

			await validateCaptcha(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockVerifyCaptchaToken).not.toHaveBeenCalled();
		});

		it("should skip captcha verification for already verified anonymous users", async () => {
			const context = createMockContext();
			const mockAnonymousUser = { id: "anon-123", captcha_verified: 1 };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return mockAnonymousUser;
				return null;
			});

			await validateCaptcha(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockVerifyCaptchaToken).not.toHaveBeenCalled();
		});

		it("should return 403 when captcha token is missing", async () => {
			const context = createMockContext();
			const mockAnonymousUser = { id: "anon-123", captcha_verified: 0 };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return mockAnonymousUser;
				return null;
			});

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "cf-connecting-ip") return "127.0.0.1";
				if (name === "user-agent") return "Mozilla/5.0";
				return null;
			});

			await validateCaptcha(context, mockNext);

			expect(context.json).toHaveBeenCalledWith(
				{
					error: {
						message: "Captcha verification required",
					},
				},
				403,
			);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should return 403 when captcha verification fails", async () => {
			const context = createMockContext();
			const mockAnonymousUser = { id: "anon-123", captcha_verified: 0 };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return mockAnonymousUser;
				return null;
			});

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "cf-connecting-ip") return "127.0.0.1";
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "X-Captcha-Token") return "invalid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockResolvedValue({
				verified: false,
				error: "Invalid token",
			});

			await validateCaptcha(context, mockNext);

			expect(context.json).toHaveBeenCalledWith(
				{
					error: {
						message: "Captcha verification failed: Invalid token",
					},
				},
				403,
			);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should update anonymous user when captcha verification succeeds", async () => {
			const context = createMockContext();
			const mockAnonymousUser = { id: "anon-123", captcha_verified: 0 };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return mockAnonymousUser;
				return null;
			});

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "cf-connecting-ip") return "127.0.0.1";
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "X-Captcha-Token") return "valid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockResolvedValue({
				verified: true,
				error: null,
			});

			await validateCaptcha(context, mockNext);

			expect(mockVerifyCaptchaToken).toHaveBeenCalledWith(
				"valid-token",
				"secret-key",
				"site-key",
			);
			expect(
				mockRepositoryManager.anonymousUsers.updateAnonymousUser,
			).toHaveBeenCalledWith("anon-123", { captcha_verified: 1 });
			expect(mockNext).toHaveBeenCalled();
		});

		it("should create and update anonymous user when no anonymous user exists", async () => {
			const context = createMockContext();
			const mockNewUser = { id: "anon-456", captcha_verified: 0 };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return null;
				return null;
			});

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "cf-connecting-ip") return "127.0.0.1";
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "X-Captcha-Token") return "valid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockResolvedValue({
				verified: true,
				error: null,
			});

			mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(
				mockNewUser,
			);

			await validateCaptcha(context, mockNext);

			expect(
				mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser,
			).toHaveBeenCalledWith("127.0.0.1", "Mozilla/5.0");
			expect(
				mockRepositoryManager.anonymousUsers.updateAnonymousUser,
			).toHaveBeenCalledWith("anon-456", { captcha_verified: 1 });
			expect(context.set).toHaveBeenCalledWith("anonymousUser", {
				...mockNewUser,
				captcha_verified: 1,
			});
			expect(mockNext).toHaveBeenCalled();
		});

		it("should handle captcha verification errors gracefully", async () => {
			const context = createMockContext();
			const mockAnonymousUser = { id: "anon-123", captcha_verified: 0 };

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return mockAnonymousUser;
				return null;
			});

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "cf-connecting-ip") return "127.0.0.1";
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "X-Captcha-Token") return "valid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockRejectedValue(new Error("Network error"));

			await validateCaptcha(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should handle anonymous user creation errors gracefully", async () => {
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.get.mockImplementation((key: string) => {
				if (key === "user") return null;
				if (key === "anonymousUser") return null;
				return null;
			});

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "cf-connecting-ip") return "127.0.0.1";
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "X-Captcha-Token") return "valid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockResolvedValue({
				verified: true,
				error: null,
			});

			mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser.mockRejectedValue(
				new Error("Database error"),
			);

			await validateCaptcha(context, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should handle IP address extraction correctly", async () => {
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.get.mockReturnValue(null);

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "x-forwarded-for") return "192.168.1.1";
				if (name === "user-agent") return "Mozilla/5.0";
				if (name === "X-Captcha-Token") return "valid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockResolvedValue({
				verified: true,
				error: null,
			});

			const mockNewUser = { id: "anon-456", captcha_verified: 0 };
			mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(
				mockNewUser,
			);

			await validateCaptcha(context, mockNext);

			expect(
				mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser,
			).toHaveBeenCalledWith("192.168.1.1", "Mozilla/5.0");
		});

		it("should use 'unknown' as fallback for missing IP and user agent", async () => {
			const context = createMockContext();

			// @ts-expect-error - mock implementation
			context.get.mockReturnValue(null);

			// @ts-expect-error - mock implementation
			context.req.header.mockImplementation((name: string) => {
				if (name === "X-Captcha-Token") return "valid-token";
				return null;
			});

			mockVerifyCaptchaToken.mockResolvedValue({
				verified: true,
				error: null,
			});

			const mockNewUser = { id: "anon-456", captcha_verified: 0 };
			mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser.mockResolvedValue(
				mockNewUser,
			);

			await validateCaptcha(context, mockNext);

			expect(
				mockRepositoryManager.anonymousUsers.getOrCreateAnonymousUser,
			).toHaveBeenCalledWith("unknown", "unknown");
		});
	});
});
