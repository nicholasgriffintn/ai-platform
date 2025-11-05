import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import {
	createOrUpdateGithubUser,
	createSession,
	deleteSession,
	getUserByGithubId,
	getUserById,
	getUserBySessionId,
	getUserSettings,
} from "../user";

const mockRepositories = {
	users: {
		getUserByGithubId: vi.fn(),
		getUserBySessionId: vi.fn(),
		getUserById: vi.fn(),
		createUser: vi.fn(),
		updateUser: vi.fn(),
		getUserByEmail: vi.fn(),
		createOauthAccount: vi.fn(),
		updateUserWithGithubData: vi.fn(),
	},
	userSettings: {
		getUserSettings: vi.fn(),
		createUserSettings: vi.fn(),
		createUserProviderSettings: vi.fn(),
	},
	sessions: {
		createSession: vi.fn(),
		deleteSession: vi.fn(),
	},
};

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
}));

describe("User Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getUserByGithubId", () => {
		it("should return user for valid GitHub ID", async () => {
			const mockUser = {
				id: 123,
				email: "user@example.com",
				github_username: "testuser",
				name: "Test User",
			};

			mockRepositories.users.getUserByGithubId.mockResolvedValue(mockUser);

			const result = await getUserByGithubId(mockRepositories as any, "github123");

			expect(mockRepositories.users.getUserByGithubId).toHaveBeenCalledWith("github123");
			expect(result).toEqual(mockUser);
		});

		it("should return null for non-existent GitHub ID", async () => {
			mockRepositories.users.getUserByGithubId.mockResolvedValue(null);

			const result = await getUserByGithubId(mockRepositories as any, "nonexistent");

			expect(result).toBeNull();
		});

		it("should handle database errors", async () => {
			mockRepositories.users.getUserByGithubId.mockRejectedValue(new Error("DB error"));

			await expect(
				getUserByGithubId(mockRepositories as any, "github123"),
			).rejects.toMatchObject({
				message: "Failed to retrieve user by GitHub ID",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("getUserBySessionId", () => {
		it("should return user for valid session ID", async () => {
			const mockUser = { id: 123, email: "user@example.com" };

			mockRepositories.users.getUserBySessionId.mockResolvedValue(mockUser);

			const result = await getUserBySessionId(mockRepositories as any, "session123");

			expect(mockRepositories.users.getUserBySessionId).toHaveBeenCalledWith(
				"session123",
			);
			expect(result).toEqual(mockUser);
		});

		it("should return null for invalid session ID", async () => {
			mockRepositories.users.getUserBySessionId.mockResolvedValue(null);

			const result = await getUserBySessionId(mockRepositories as any, "invalid");

			expect(result).toBeNull();
		});

		it("should handle database errors", async () => {
			mockRepositories.users.getUserBySessionId.mockRejectedValue(new Error("DB error"));

			await expect(
				getUserBySessionId(mockRepositories as any, "session123"),
			).rejects.toMatchObject({
				message: "Failed to retrieve user by session ID",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("getUserSettings", () => {
		it("should return user settings for valid user ID", async () => {
			const mockSettings = { theme: "dark", language: "en" };

			mockRepositories.userSettings.getUserSettings.mockResolvedValue(mockSettings);

			const result = await getUserSettings(mockRepositories as any, 123);

			expect(mockRepositories.userSettings.getUserSettings).toHaveBeenCalledWith(123);
			expect(result).toEqual(mockSettings);
		});

		it("should return null for invalid user ID", async () => {
			const result = await getUserSettings(mockRepositories as any, 0);

			expect(result).toBeNull();
		});

		it("should handle database errors", async () => {
			mockRepositories.userSettings.getUserSettings.mockRejectedValue(new Error("DB error"));

			await expect(getUserSettings(mockRepositories as any, 123)).rejects.toMatchObject({
				message: "Failed to retrieve user settings",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("getUserById", () => {
		it("should return user for valid ID", async () => {
			const mockUser = { id: 123, email: "user@example.com" };

			mockRepositories.users.getUserById.mockResolvedValue(mockUser);

			const result = await getUserById(mockRepositories as any, 123);

			expect(mockRepositories.users.getUserById).toHaveBeenCalledWith(123);
			expect(result).toEqual(mockUser);
		});

		it("should return null for non-existent user", async () => {
			mockRepositories.users.getUserById.mockResolvedValue(null);

			const result = await getUserById(mockRepositories as any, 999);

			expect(result).toBeNull();
		});

		it("should handle database errors", async () => {
			mockRepositories.users.getUserById.mockRejectedValue(new Error("DB error"));

			await expect(getUserById(mockRepositories as any, 123)).rejects.toMatchObject({
				message: "Failed to retrieve user by ID",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("createOrUpdateGithubUser", () => {
		const mockUserData = {
			githubId: "github123",
			username: "testuser",
			email: "user@example.com",
			name: "Test User",
			avatar_url: "https://avatar.com/user.jpg",
		};

		it("should update existing GitHub user", async () => {
			const existingUser = {
				id: 123,
				email: "user@example.com",
				github_username: "testuser",
				name: "Test User",
				avatar_url: null,
				company: null,
				site: null,
				location: null,
				bio: null,
				twitter_username: null,
				role: null,
				created_at: "2024-01-01",
				updated_at: "2024-01-01",
				setup_at: null,
				terms_accepted_at: null,
				plan_id: null,
				last_active_at: null,
				stripe_customer_id: null,
				stripe_subscription_id: null,
			};

			mockRepositories.users.getUserByGithubId.mockResolvedValue(existingUser);
			mockRepositories.users.updateUser.mockResolvedValue(true);

			const result = await createOrUpdateGithubUser(mockRepositories as any, mockUserData);

			expect(mockRepositories.users.getUserByGithubId).toHaveBeenCalledWith("github123");
			expect(mockRepositories.users.updateUser).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					email: "user@example.com",
					github_username: "testuser",
					name: "Test User",
				}),
			);
			expect(result.id).toBe(123);
		});

		it("should link GitHub to existing email user", async () => {
			const existingEmailUser = { id: 456, email: "user@example.com", name: "Test", avatar_url: null, company: null, location: null, bio: null, twitter_username: null, site: null };

			mockRepositories.users.getUserByGithubId.mockResolvedValue(null);
			mockRepositories.users.getUserByEmail.mockResolvedValue(existingEmailUser);
			mockRepositories.users.createOauthAccount.mockResolvedValue(true);
			mockRepositories.users.updateUserWithGithubData.mockResolvedValue(true);

			const result = await createOrUpdateGithubUser(mockRepositories as any, mockUserData);

			expect(mockRepositories.users.createOauthAccount).toHaveBeenCalledWith(
				456,
				"github",
				"github123",
			);
			expect(mockRepositories.users.updateUserWithGithubData).toHaveBeenCalledWith(
				456,
				mockUserData,
			);
			expect(result.id).toBe(456);
		});

		it("should create new user", async () => {
			const newUser = {
				id: 789,
				email: "user@example.com",
				github_username: "testuser",
			};

			mockRepositories.users.getUserByGithubId.mockResolvedValue(null);
			mockRepositories.users.getUserByEmail.mockResolvedValue(null);
			mockRepositories.users.createUser.mockResolvedValue(newUser);
			mockRepositories.userSettings.createUserSettings.mockResolvedValue(true);
			mockRepositories.userSettings.createUserProviderSettings.mockResolvedValue(true);
			mockRepositories.users.createOauthAccount.mockResolvedValue(true);

			const result = await createOrUpdateGithubUser(mockRepositories as any, mockUserData);

			expect(mockRepositories.users.createUser).toHaveBeenCalledWith(mockUserData);
			expect(mockRepositories.users.createOauthAccount).toHaveBeenCalledWith(
				789,
				"github",
				"github123",
			);
			expect(result.id).toBe(789);
		});

		it("should throw error if user creation fails", async () => {
			mockRepositories.users.getUserByGithubId.mockResolvedValue(null);
			mockRepositories.users.getUserByEmail.mockResolvedValue(null);
			mockRepositories.users.createUser.mockResolvedValue(null);

			await expect(
				createOrUpdateGithubUser(mockRepositories as any, mockUserData),
			).rejects.toThrow("Failed to create user");
		});

		it("should handle database errors", async () => {
			mockRepositories.users.getUserByGithubId.mockRejectedValue(new Error("DB error"));

			await expect(
				createOrUpdateGithubUser(mockRepositories as any, mockUserData),
			).rejects.toMatchObject({
				message: "Failed to retrieve user by GitHub ID",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("createSession", () => {
		it("should create session successfully", async () => {
			const mockSessionId = "session-uuid";

			vi.stubGlobal("crypto", {
				randomUUID: vi.fn().mockReturnValue(mockSessionId),
			});
			mockRepositories.sessions.createSession.mockResolvedValue(true);

			const result = await createSession(mockRepositories as any, 123);

			expect(mockRepositories.sessions.createSession).toHaveBeenCalledWith(
				mockSessionId,
				123,
				expect.any(Date),
			);
			expect(result).toBe(mockSessionId);
		});

		it("should create session with custom expiration", async () => {
			const mockSessionId = "session-uuid";

			vi.stubGlobal("crypto", {
				randomUUID: vi.fn().mockReturnValue(mockSessionId),
			});
			mockRepositories.sessions.createSession.mockResolvedValue(true);

			await createSession(mockRepositories as any, 123, 14);

			const expectedExpiry = new Date();
			expectedExpiry.setDate(expectedExpiry.getDate() + 14);

			expect(mockRepositories.sessions.createSession).toHaveBeenCalledWith(
				mockSessionId,
				123,
				expect.any(Date),
			);
		});

		it("should handle database errors", async () => {
			vi.stubGlobal("crypto", {
				randomUUID: vi.fn().mockReturnValue("session-uuid"),
			});
			mockRepositories.sessions.createSession.mockRejectedValue(new Error("DB error"));

			await expect(createSession(mockRepositories as any, 123)).rejects.toMatchObject({
				message: "Failed to create session",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});

	describe("deleteSession", () => {
		it("should delete session successfully", async () => {
			mockRepositories.sessions.deleteSession.mockResolvedValue(true);

			await deleteSession(mockRepositories as any, "session123");

			expect(mockRepositories.sessions.deleteSession).toHaveBeenCalledWith("session123");
		});

		it("should handle database errors", async () => {
			mockRepositories.sessions.deleteSession.mockRejectedValue(new Error("DB error"));

			await expect(
				deleteSession(mockRepositories as any, "session123"),
			).rejects.toMatchObject({
				message: "Failed to delete session",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});
	});
});
