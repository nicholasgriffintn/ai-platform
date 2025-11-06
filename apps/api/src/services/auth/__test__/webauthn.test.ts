import {
	type MockedFunction,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import {
	generatePasskeyRegistrationOptions,
	getPasskeyWithUser,
	getUserPasskeys,
	getWebAuthnChallenge,
	registerPasskey,
	saveWebAuthnChallenge,
	verifyAndRegisterPasskey,
	verifyPasskeyAuthentication,
} from "../webauthn";

vi.mock("@simplewebauthn/server", () => ({
	generateAuthenticationOptions: vi.fn(),
	generateRegistrationOptions: vi.fn(),
	verifyAuthenticationResponse: vi.fn(),
	verifyRegistrationResponse: vi.fn(),
}));

vi.mock("~/utils/base64url", () => ({
	decodeBase64Url: vi.fn(),
}));

const mockRepositories = {
	webAuthn: {
		createChallenge: vi.fn(),
		getChallenge: vi.fn(),
		getChallengeByUserId: vi.fn(),
		deleteChallenge: vi.fn(),
		createPasskey: vi.fn(),
		getPasskeysByUserId: vi.fn(),
		getPasskeyByCredentialId: vi.fn(),
		updatePasskeyCounter: vi.fn(),
		deletePasskey: vi.fn(),
	},
};

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
}));

describe("WebAuthn Service", () => {
	let mockGenerateRegistrationOptions: MockedFunction<any>;
	let _mockGenerateAuthenticationOptions: MockedFunction<any>;
	let mockVerifyRegistrationResponse: MockedFunction<any>;
	let mockVerifyAuthenticationResponse: MockedFunction<any>;
	let mockDecodeBase64Url: MockedFunction<any>;

	beforeEach(async () => {
		vi.clearAllMocks();

		const webauthnServer = await import("@simplewebauthn/server");
		mockGenerateRegistrationOptions = vi.mocked(
			webauthnServer.generateRegistrationOptions,
		);
		_mockGenerateAuthenticationOptions = vi.mocked(
			webauthnServer.generateAuthenticationOptions,
		);
		mockVerifyRegistrationResponse = vi.mocked(
			webauthnServer.verifyRegistrationResponse,
		);
		mockVerifyAuthenticationResponse = vi.mocked(
			webauthnServer.verifyAuthenticationResponse,
		);

		const base64utils = await import("~/utils/base64url");
		mockDecodeBase64Url = vi.mocked(base64utils.decodeBase64Url);
	});

	describe("saveWebAuthnChallenge", () => {
		it("should save challenge successfully", async () => {
			mockRepositories.webAuthn.createChallenge.mockResolvedValue(true);

			await saveWebAuthnChallenge(mockRepositories as any, "challenge123", 123);

			expect(mockRepositories.webAuthn.createChallenge).toHaveBeenCalledWith(
				"challenge123",
				123,
			);
		});

		it("should handle database errors", async () => {
			mockRepositories.webAuthn.createChallenge.mockRejectedValue(
				new Error("DB error"),
			);

			await expect(
				saveWebAuthnChallenge(mockRepositories as any, "challenge123"),
			).rejects.toThrow("Failed to save WebAuthn challenge");
		});
	});

	describe("getWebAuthnChallenge", () => {
		it("should get challenge by challenge and userId", async () => {
			const mockChallenge = { challenge: "challenge123" };
			mockRepositories.webAuthn.getChallenge.mockResolvedValue(mockChallenge);

			const result = await getWebAuthnChallenge(
				mockRepositories as any,
				"challenge123",
				123,
			);

			expect(mockRepositories.webAuthn.getChallenge).toHaveBeenCalledWith(
				"challenge123",
				123,
			);
			expect(result).toBe("challenge123");
		});

		it("should get challenge by challenge only", async () => {
			const mockChallenge = { challenge: "challenge123" };
			mockRepositories.webAuthn.getChallenge.mockResolvedValue(mockChallenge);

			const result = await getWebAuthnChallenge(mockRepositories as any, "challenge123");

			expect(mockRepositories.webAuthn.getChallenge).toHaveBeenCalledWith(
				"challenge123",
			);
			expect(result).toBe("challenge123");
		});

		it("should get challenge by userId only", async () => {
			const mockChallenge = { challenge: "challenge123" };
			mockRepositories.webAuthn.getChallengeByUserId.mockResolvedValue(
				mockChallenge,
			);

			const result = await getWebAuthnChallenge(mockRepositories as any, undefined, 123);

			expect(mockRepositories.webAuthn.getChallengeByUserId).toHaveBeenCalledWith(
				123,
			);
			expect(result).toBe("challenge123");
		});

		it("should throw error if challenge not found", async () => {
			mockRepositories.webAuthn.getChallenge.mockResolvedValue(null);

			await expect(
				getWebAuthnChallenge(mockRepositories as any, "invalid"),
			).rejects.toMatchObject({
				message: "WebAuthn challenge not found or expired",
				type: "AUTHENTICATION_ERROR",
			});
		});
	});

	describe("registerPasskey", () => {
		it("should register passkey successfully", async () => {
			const publicKey = new Uint8Array([1, 2, 3]);
			mockRepositories.webAuthn.createPasskey.mockResolvedValue(true);

			await registerPasskey(
				mockRepositories as any,
				123,
				"credentialId",
				publicKey,
				1,
				"platform",
				true,
				["usb"],
			);

			expect(mockRepositories.webAuthn.createPasskey).toHaveBeenCalledWith(
				123,
				"credentialId",
				publicKey,
				1,
				"platform",
				true,
				["usb"],
			);
		});

		it("should handle database errors", async () => {
			const publicKey = new Uint8Array([1, 2, 3]);
			mockRepositories.webAuthn.createPasskey.mockRejectedValue(new Error("DB error"));

			await expect(
				registerPasskey(
					mockRepositories as any,
					123,
					"credentialId",
					publicKey,
					1,
					"platform",
					true,
				),
			).rejects.toThrow("Failed to register passkey");
		});
	});

	describe("getUserPasskeys", () => {
		it("should return user passkeys", async () => {
			const mockPasskeys = [
				{ id: 1, credential_id: "cred1" },
				{ id: 2, credential_id: "cred2" },
			];
			mockRepositories.webAuthn.getPasskeysByUserId.mockResolvedValue(mockPasskeys);

			const result = await getUserPasskeys(mockRepositories as any, 123);

			expect(mockRepositories.webAuthn.getPasskeysByUserId).toHaveBeenCalledWith(123);
			expect(result).toEqual(mockPasskeys);
		});

		it("should handle database errors gracefully", async () => {
			mockRepositories.webAuthn.getPasskeysByUserId.mockRejectedValue(new Error("DB error"));

			const result = await getUserPasskeys(mockRepositories as any, 123);

			expect(result).toEqual([]);
		});
	});

	describe("getPasskeyWithUser", () => {
		it("should return passkey with user data", async () => {
			const mockResult = {
				user_id: 123,
				email: "user@example.com",
				name: "Test User",
				credential_id: "cred123",
			};
			mockRepositories.webAuthn.getPasskeyByCredentialId.mockResolvedValue(mockResult);

			const result = await getPasskeyWithUser(mockRepositories as any, "cred123");

			expect(mockRepositories.webAuthn.getPasskeyByCredentialId).toHaveBeenCalledWith(
				"cred123",
			);
			expect(result).toEqual({
				credential: mockResult,
				user: {
					id: 123,
					email: "user@example.com",
					name: "Test User",
					github_username: null,
					avatar_url: null,
					role: null,
				},
			});
		});

		it("should return null if passkey not found", async () => {
			mockRepositories.webAuthn.getPasskeyByCredentialId.mockResolvedValue(null);

			const result = await getPasskeyWithUser(mockRepositories as any, "invalid");

			expect(result).toBeNull();
		});

		it("should handle database errors gracefully", async () => {
			mockRepositories.webAuthn.getPasskeyByCredentialId.mockRejectedValue(
				new Error("DB error"),
			);

			const result = await getPasskeyWithUser(mockRepositories as any, "cred123");

			expect(result).toBeNull();
		});
	});

	describe("generatePasskeyRegistrationOptions", () => {
		it("should generate registration options", async () => {
			const mockUser = {
				id: 123,
				email: "user@example.com",
				github_username: "testuser",
			} as any;
			const mockCredentials = [
				{ credential_id: "cred1", transports: '["usb"]' },
			];
			const mockOptions = {
				challenge: "challenge123",
				rp: { name: "Test App", id: "example.com" },
			};

			mockRepositories.webAuthn.getPasskeysByUserId.mockResolvedValue(mockCredentials);
			mockGenerateRegistrationOptions.mockResolvedValue(mockOptions);
			mockRepositories.webAuthn.createChallenge.mockResolvedValue(true);

			const result = await generatePasskeyRegistrationOptions(
				mockRepositories as any,
				mockUser,
				"Test App",
				"example.com",
			);

			expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					rpName: "Test App",
					rpID: "example.com",
					userName: "testuser",
					excludeCredentials: expect.arrayContaining([
						expect.objectContaining({
							id: "cred1",
							type: "public-key",
						}),
					]),
				}),
			);
			expect(result).toEqual(mockOptions);
		});

		it("should throw error for user without ID", async () => {
			const mockUser = { email: "user@example.com" } as any;

			await expect(
				generatePasskeyRegistrationOptions(
					mockRepositories as any,
					mockUser,
					"Test App",
					"example.com",
				),
			).rejects.toThrow("Failed to generate passkey registration options");
		});
	});

	describe("verifyAndRegisterPasskey", () => {
		it("should verify and register passkey successfully", async () => {
			const mockUser = { id: 123 } as any;
			const mockResponse = {
				id: "credentialId",
				rawId: "credentialId",
			} as any;
			const mockVerification = {
				verified: true,
				registrationInfo: {
					credential: {
						publicKey: new Uint8Array([1, 2, 3]),
						counter: 1,
					},
					credentialDeviceType: "platform",
					credentialBackedUp: true,
				},
			};

			mockRepositories.webAuthn.getChallengeByUserId.mockResolvedValue({
				challenge: "challenge123",
			});
			mockVerifyRegistrationResponse.mockResolvedValue(mockVerification);
			mockRepositories.webAuthn.getPasskeysByUserId.mockResolvedValue([]);
			mockRepositories.webAuthn.createPasskey.mockResolvedValue(true);
			mockRepositories.webAuthn.deleteChallenge.mockResolvedValue(true);

			const result = await verifyAndRegisterPasskey(
				mockRepositories as any,
				mockUser,
				mockResponse,
				"https://example.com",
				"example.com",
			);

			expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith({
				response: mockResponse,
				expectedChallenge: "challenge123",
				expectedOrigin: "https://example.com",
				expectedRPID: "example.com",
			});
			expect(result).toBe(true);
		});

		it("should throw error for duplicate credential", async () => {
			const mockUser = { id: 123 } as any;
			const mockResponse = { id: "credentialId", rawId: "credentialId" } as any;
			const mockVerification = {
				verified: true,
				registrationInfo: {
					credential: { publicKey: new Uint8Array([1, 2, 3]), counter: 1 },
					credentialDeviceType: "platform",
					credentialBackedUp: true,
				},
			};

			mockRepositories.webAuthn.getChallengeByUserId.mockResolvedValue({
				challenge: "challenge123",
			});
			mockVerifyRegistrationResponse.mockResolvedValue(mockVerification);
			mockRepositories.webAuthn.getPasskeysByUserId.mockResolvedValue([
				{ credential_id: "credentialId" },
			]);

			await expect(
				verifyAndRegisterPasskey(
					mockRepositories as any,
					mockUser,
					mockResponse,
					"https://example.com",
					"example.com",
				),
			).rejects.toThrow("WebAuthn verifyAndRegisterPasskey failed");
		});
	});

	describe("verifyPasskeyAuthentication", () => {
		it("should verify authentication successfully", async () => {
			const mockResponse = {
				id: "credentialId",
				response: {
					clientDataJSON: "eyJjaGFsbGVuZ2UiOiJjaGFsbGVuZ2UxMjMifQ", // base64 encoded JSON
				},
			} as any;
			const mockCredential = {
				user_id: 123,
				email: "user@example.com",
				public_key: "cHVibGljS2V5", // base64 encoded
				counter: 1,
			};
			const mockVerification = {
				verified: true,
				authenticationInfo: { newCounter: 2 },
			};

			mockRepositories.webAuthn.getPasskeyByCredentialId.mockResolvedValue(mockCredential);
			mockDecodeBase64Url.mockReturnValue(
				new TextEncoder().encode('{"challenge":"challenge123"}'),
			);
			mockRepositories.webAuthn.getChallenge.mockResolvedValue({
				challenge: "challenge123",
			});
			mockDecodeBase64Url.mockReturnValueOnce(
				new TextEncoder().encode('{"challenge":"challenge123"}'),
			); // clientData
			mockDecodeBase64Url.mockReturnValueOnce(new Uint8Array([1, 2, 3])); // publicKey
			mockVerifyAuthenticationResponse.mockResolvedValue(mockVerification);
			mockRepositories.webAuthn.updatePasskeyCounter.mockResolvedValue(true);
			mockRepositories.webAuthn.deleteChallenge.mockResolvedValue(true);

			const result = await verifyPasskeyAuthentication(
				mockRepositories as any,
				mockResponse,
				"https://example.com",
				"example.com",
			);

			expect(result).toEqual({
				verified: true,
				user: {
					id: 123,
					email: "user@example.com",
					name: null,
					github_username: null,
					avatar_url: null,
					role: null,
				},
			});
		});

		it("should throw error for unregistered authenticator", async () => {
			const mockResponse = { id: "unknown" } as any;

			mockRepositories.webAuthn.getPasskeyByCredentialId.mockResolvedValue(null);

			await expect(
				verifyPasskeyAuthentication(
					mockRepositories as any,
					mockResponse,
					"https://example.com",
					"example.com",
				),
			).rejects.toThrow("Authenticator not registered");
		});
	});
});
