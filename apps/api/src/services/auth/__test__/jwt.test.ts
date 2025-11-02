import {
	type MockedFunction,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { generateJwtToken, getUserByJwtToken, verifyJwtToken } from "../jwt";

vi.mock("@tsndr/cloudflare-worker-jwt", () => ({
	default: {
		sign: vi.fn(),
		verify: vi.fn(),
	},
}));

vi.mock("~/lib/database", () => ({
	Database: {
		getInstance: vi.fn(),
	},
}));

vi.mock("../user", () => ({
	getUserById: vi.fn(),
}));

describe("JWT Service", () => {
	let mockJwtSign: MockedFunction<any>;
	let mockJwtVerify: MockedFunction<any>;
	let mockGetUserById: MockedFunction<any>;

	beforeEach(async () => {
		vi.clearAllMocks();

		const jwt = await import("@tsndr/cloudflare-worker-jwt");
		mockJwtSign = vi.mocked(jwt.default.sign);
		mockJwtVerify = vi.mocked(jwt.default.verify);

		const userModule = await import("../user");
		mockGetUserById = vi.mocked(userModule.getUserById);

		const { Database } = await import("~/lib/database");
		const mockDatabase = { getInstance: vi.fn() };
		vi.mocked(Database.getInstance).mockReturnValue(mockDatabase as any);
	});

	describe("generateJwtToken", () => {
		it("should generate JWT token for user", async () => {
			const mockUser = {
				id: 123,
				email: "test@example.com",
				name: "Test User",
			} as any;
			const mockToken = "mock-jwt-token";

			mockJwtSign.mockResolvedValue(mockToken);

			const result = await generateJwtToken(mockUser, "secret");

			expect(mockJwtSign).toHaveBeenCalledWith(
				expect.objectContaining({
					sub: "123",
					email: "test@example.com",
					name: "Test User",
					iss: "assistant",
					aud: "assistant",
				}),
				"secret",
				{ algorithm: "HS256" },
			);
			expect(result).toBe(mockToken);
		});

		it("should use custom expiration time", async () => {
			const mockUser = { id: 123 } as any;
			const customExpiration = 3600;
			mockJwtSign.mockResolvedValue("token");

			await generateJwtToken(mockUser, "secret", customExpiration);

			expect(mockJwtSign).toHaveBeenCalledWith(
				expect.objectContaining({
					exp: expect.any(Number),
				}),
				"secret",
				{ algorithm: "HS256" },
			);
		});

		it("should throw error when JWT signing fails", async () => {
			const mockUser = { id: 123 } as any;
			mockJwtSign.mockRejectedValue(new Error("JWT error"));

			await expect(generateJwtToken(mockUser, "secret")).rejects.toThrow(
				"JWT error",
			);
		});
	});

	describe("verifyJwtToken", () => {
		it("should verify valid JWT token", async () => {
			const mockDecoded = {
				header: { typ: "JWT", alg: "HS256" },
				payload: { sub: "123", email: "test@example.com" },
			};
			mockJwtVerify.mockResolvedValue(mockDecoded);

			const result = await verifyJwtToken("valid-token", "secret");

			expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", "secret", {
				algorithm: "HS256",
			});
			expect(result).toEqual(mockDecoded);
		});

		it("should throw error for invalid token", async () => {
			mockJwtVerify.mockResolvedValue(null);

			await expect(
				verifyJwtToken("invalid-token", "secret"),
			).rejects.toMatchObject({
				message: "Invalid or expired authentication token",
				type: ErrorType.AUTHENTICATION_ERROR,
				name: "AssistantError",
			});
		});

		it("should handle verification errors", async () => {
			mockJwtVerify.mockRejectedValue(new Error("Verification failed"));

			await expect(verifyJwtToken("token", "secret")).rejects.toMatchObject({
				message: "Invalid or expired authentication token",
				type: ErrorType.AUTHENTICATION_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("getUserByJwtToken", () => {
		it("should return user for valid token", async () => {
			const mockDecoded = {
				payload: { sub: "123" },
			};
			const mockUser = { id: 123, email: "test@example.com" };

			mockJwtVerify.mockResolvedValue(mockDecoded);
			mockGetUserById.mockResolvedValue(mockUser);

			const result = await getUserByJwtToken(
				{} as any,
				"valid-token",
				"secret",
			);

			expect(mockGetUserById).toHaveBeenCalledWith(expect.any(Object), 123);
			expect(result).toEqual(mockUser);
		});

		it("should handle non-existent user", async () => {
			const mockDecoded = {
				payload: { sub: "999" },
			};

			mockJwtVerify.mockResolvedValue(mockDecoded);
			mockGetUserById.mockResolvedValue(null);

			const result = await getUserByJwtToken(
				{} as any,
				"valid-token",
				"secret",
			);

			expect(result).toBeNull();
		});

		it("should propagate AssistantError from token verification", async () => {
			const error = new AssistantError(
				"Invalid token",
				ErrorType.AUTHENTICATION_ERROR,
			);
			mockJwtVerify.mockRejectedValue(error);

			await expect(
				getUserByJwtToken({} as any, "invalid-token", "secret"),
			).rejects.toThrow("Invalid or expired authentication token");
		});

		it("should wrap other errors", async () => {
			mockJwtVerify.mockRejectedValue(new Error("Some error"));

			await expect(
				getUserByJwtToken({} as any, "token", "secret"),
			).rejects.toThrow("Invalid or expired authentication token");
		});
	});
});
