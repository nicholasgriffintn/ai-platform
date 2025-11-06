import {
	type MockedFunction,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { sendMagicLinkEmail } from "~/services/notifications";
import { AssistantError, ErrorType } from "~/utils/errors";
import { requestMagicLink, verifyMagicLink } from "../magicLink";

vi.mock("@tsndr/cloudflare-worker-jwt", () => ({
	sign: vi.fn(),
	verify: vi.fn(),
	decode: vi.fn(),
}));

vi.mock("aws4fetch", () => ({
	AwsClient: vi.fn(),
}));

const mockRepositories = {
	users: {
		getUserByEmail: vi.fn(),
		createUser: vi.fn(),
		getUserById: vi.fn(),
	},
	userSettings: {
		createUserSettings: vi.fn(),
		createUserProviderSettings: vi.fn(),
	},
	magicLinkNonces: {
		createNonce: vi.fn(),
	},
};

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
}));

vi.mock("~/lib/database", () => ({
	Database: vi.fn((env) => ({
		consumeMagicLinkNonce: vi.fn(),
	})),
}));

vi.mock("~/services/notifications", () => ({
	sendMagicLinkEmail: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;
global.TextEncoder = class {
	encode(str: string) {
		return new Uint8Array(str.length);
	}
} as any;

describe("Magic Link Service", () => {
	let mockJwtSign: MockedFunction<any>;
	let mockJwtVerify: MockedFunction<any>;
	let mockJwtDecode: MockedFunction<any>;
	let mockAwsClient: any;
	let mockDatabase: any;
	let mockSendMagicLinkEmail: MockedFunction<any>;

	beforeEach(async () => {
		vi.clearAllMocks();

		const jwt = await import("@tsndr/cloudflare-worker-jwt");
		mockJwtSign = vi.mocked(jwt.sign);
		mockJwtVerify = vi.mocked(jwt.verify);
		mockJwtDecode = vi.mocked(jwt.decode);

		const { AwsClient } = await import("aws4fetch");
		mockAwsClient = {
			sign: vi.fn(),
		};
		vi.mocked(AwsClient).mockImplementation(() => mockAwsClient);

		const { Database } = await import("~/lib/database");
		mockDatabase = {
			consumeMagicLinkNonce: vi.fn(),
			repositories: {
				users: {
					getUserById: mockRepositories.users.getUserById,
				},
			},
		};
		vi.mocked(Database).mockImplementation(() => mockDatabase);

		mockRepositories.userSettings.createUserSettings.mockResolvedValue(true);
		mockRepositories.userSettings.createUserProviderSettings.mockResolvedValue(true);

		const notifications = await import("~/services/notifications");
		mockSendMagicLinkEmail = vi.mocked(notifications.sendMagicLinkEmail);
	});

	describe("sendMagicLinkEmail", () => {
		const mockEnv = {
			DB: {} as any,
			AWS_SES_ACCESS_KEY_ID: "test-key",
			AWS_SES_SECRET_ACCESS_KEY: "test-secret",
			SES_EMAIL_FROM: "test@example.com",
		} as any;

		it("should send magic link email successfully", async () => {
			mockSendMagicLinkEmail.mockResolvedValue(undefined);

			await sendMagicLinkEmail(
				mockEnv,
				"user@example.com",
				"https://example.com/auth/magic?token=abc&nonce=123",
			);

			expect(mockSendMagicLinkEmail).toHaveBeenCalledWith(
				mockEnv,
				"user@example.com",
				"https://example.com/auth/magic?token=abc&nonce=123",
			);
		});

		it("should throw error for missing AWS configuration", async () => {
			const incompleteEnv = { AWS_SES_ACCESS_KEY_ID: "test-key" } as any;

			mockSendMagicLinkEmail.mockRejectedValue(
				new AssistantError(
					"AWS SES configuration missing",
					ErrorType.CONFIGURATION_ERROR,
				),
			);

			await expect(
				sendMagicLinkEmail(
					incompleteEnv,
					"user@example.com",
					"https://example.com/magic",
				),
			).rejects.toMatchObject({
				message: "AWS SES configuration missing",
				type: ErrorType.CONFIGURATION_ERROR,
				name: "AssistantError",
			});
		});

		it("should handle SES API errors", async () => {
			mockSendMagicLinkEmail.mockRejectedValue(
				new AssistantError(
					"Failed to send magic link: error",
					ErrorType.EMAIL_SEND_FAILED,
				),
			);

			await expect(
				sendMagicLinkEmail(
					mockEnv,
					"user@example.com",
					"https://example.com/magic",
				),
			).rejects.toThrow("Failed to send magic link");
		});
	});

	describe("requestMagicLink", () => {
		const mockEnv = {
			DB: {} as any,
			EMAIL_JWT_SECRET: "test-secret",
		} as any;

		it("should request magic link for existing user", async () => {
			const mockUser = { id: 123, email: "user@example.com" };
			const mockToken = "test-token";
			const mockNonce = "test-nonce";

			mockRepositories.users.getUserByEmail.mockResolvedValue(mockUser);
			mockJwtSign.mockResolvedValue(mockToken);

			const mockUUID = vi.fn().mockReturnValue(mockNonce);
			vi.stubGlobal("crypto", { randomUUID: mockUUID });

			const result = await requestMagicLink(mockEnv, "user@example.com");

			expect(mockRepositories.users.getUserByEmail).toHaveBeenCalledWith(
				"user@example.com",
			);
			expect(mockJwtSign).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "123",
					email: "user@example.com",
				}),
				"test-secret",
				{ algorithm: "HS256" },
			);
			expect(mockRepositories.magicLinkNonces.createNonce).toHaveBeenCalledWith(
				mockNonce,
				123,
				expect.any(Date),
			);
			expect(result).toEqual({ token: mockToken, nonce: mockNonce });
		});

		it("should create new user if not exists", async () => {
			const mockNewUser = { id: 456, email: "newuser@example.com" };
			const mockToken = "test-token";
			const mockNonce = "test-nonce";

			mockRepositories.users.getUserByEmail.mockResolvedValue(null);
			mockRepositories.users.createUser.mockResolvedValue(mockNewUser);
			mockJwtSign.mockResolvedValue(mockToken);

			vi.stubGlobal("crypto", {
				randomUUID: vi.fn().mockReturnValue(mockNonce),
			});

			const result = await requestMagicLink(mockEnv, "newuser@example.com");

			expect(mockRepositories.users.createUser).toHaveBeenCalledWith({
				email: "newuser@example.com",
			});
			expect(result).toEqual({ token: mockToken, nonce: mockNonce });
		});

		it("should throw error for missing JWT secret", async () => {
			const envWithoutSecret = {} as any;

			await expect(
				requestMagicLink(envWithoutSecret, "user@example.com"),
			).rejects.toMatchObject({
				message: "JWT secret not configured",
				type: ErrorType.CONFIGURATION_ERROR,
				name: "AssistantError",
			});
		});

		it("should handle user creation failure", async () => {
			mockRepositories.users.getUserByEmail.mockResolvedValue(null);
			mockRepositories.users.createUser.mockRejectedValue(new Error("DB error"));

			const result = await requestMagicLink(mockEnv, "user@example.com");

			expect(result).toEqual({ token: "", nonce: "" });
		});
	});

	describe("verifyMagicLink", () => {
		const mockEnv = {
			DB: {} as any,
			EMAIL_JWT_SECRET: "test-secret",
		} as any;

		it("should verify valid magic link", async () => {
			const mockPayload = {
				userId: "123",
				email: "user@example.com",
				exp: Math.floor(Date.now() / 1000) + 300,
			};
			const mockUser = { id: 123, email: "user@example.com" };

			mockJwtVerify.mockResolvedValue(true);
			mockJwtDecode.mockReturnValue({ payload: mockPayload });
			mockDatabase.consumeMagicLinkNonce.mockResolvedValue(true);
			mockRepositories.users.getUserById.mockResolvedValue(mockUser);

			const result = await verifyMagicLink(
				mockEnv,
				"valid-token",
				"valid-nonce",
			);

			expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", "test-secret", {
				algorithm: "HS256",
			});
			expect(mockDatabase.consumeMagicLinkNonce).toHaveBeenCalledWith(
				"valid-nonce",
				123,
			);
			expect(mockRepositories.users.getUserById).toHaveBeenCalledWith(123);
			expect(result).toBe(123);
		});

		it("should throw error for invalid token", async () => {
			mockJwtVerify.mockResolvedValue(false);

			await expect(
				verifyMagicLink(mockEnv, "invalid-token", "nonce"),
			).rejects.toMatchObject({
				message: "Invalid or expired token/nonce",
				type: ErrorType.AUTHENTICATION_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error for expired token", async () => {
			const expiredPayload = {
				userId: "123",
				exp: Math.floor(Date.now() / 1000) - 300,
			};

			mockJwtVerify.mockResolvedValue(true);
			mockJwtDecode.mockReturnValue({ payload: expiredPayload });

			await expect(
				verifyMagicLink(mockEnv, "expired-token", "nonce"),
			).rejects.toMatchObject({
				message: "Invalid or expired token/nonce",
				type: ErrorType.AUTHENTICATION_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error for invalid nonce", async () => {
			const mockPayload = {
				userId: "123",
				exp: Math.floor(Date.now() / 1000) + 300,
			};

			mockJwtVerify.mockResolvedValue(true);
			mockJwtDecode.mockReturnValue({ payload: mockPayload });
			mockDatabase.consumeMagicLinkNonce.mockResolvedValue(false);

			await expect(
				verifyMagicLink(mockEnv, "token", "invalid-nonce"),
			).rejects.toMatchObject({
				message: "Invalid or expired token/nonce",
				type: ErrorType.AUTHENTICATION_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error if user not found", async () => {
			const mockPayload = {
				userId: "999",
				exp: Math.floor(Date.now() / 1000) + 300,
			};

			mockJwtVerify.mockResolvedValue(true);
			mockJwtDecode.mockReturnValue({ payload: mockPayload });
			mockDatabase.consumeMagicLinkNonce.mockResolvedValue(true);
			mockRepositories.users.getUserById.mockResolvedValue(null);

			await expect(
				verifyMagicLink(mockEnv, "token", "nonce"),
			).rejects.toMatchObject({
				message: "User not found for valid token",
				type: ErrorType.INTERNAL_ERROR,
				name: "AssistantError",
			});
		});
	});
});
