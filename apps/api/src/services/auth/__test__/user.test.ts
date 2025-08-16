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

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: vi.fn(),
  },
}));

describe("User Service", () => {
  let mockDatabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { Database } = await import("~/lib/database");
    mockDatabase = {
      getUserByGithubId: vi.fn(),
      getUserBySessionId: vi.fn(),
      getUserSettings: vi.fn(),
      getUserById: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      getUserByEmail: vi.fn(),
      createOauthAccount: vi.fn(),
      updateUserWithGithubData: vi.fn(),
      createSession: vi.fn(),
      deleteSession: vi.fn(),
    };
    vi.mocked(Database.getInstance).mockReturnValue(mockDatabase);
  });

  describe("getUserByGithubId", () => {
    it("should return user for valid GitHub ID", async () => {
      const mockUser = {
        id: 123,
        email: "user@example.com",
        github_username: "testuser",
        name: "Test User",
      };

      mockDatabase.getUserByGithubId.mockResolvedValue(mockUser);

      const result = await getUserByGithubId(mockDatabase, "github123");

      expect(mockDatabase.getUserByGithubId).toHaveBeenCalledWith("github123");
      expect(result).toEqual(mockUser);
    });

    it("should return null for non-existent GitHub ID", async () => {
      mockDatabase.getUserByGithubId.mockResolvedValue(null);

      const result = await getUserByGithubId(mockDatabase, "nonexistent");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabase.getUserByGithubId.mockRejectedValue(new Error("DB error"));

      await expect(
        getUserByGithubId(mockDatabase, "github123"),
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

      mockDatabase.getUserBySessionId.mockResolvedValue(mockUser);

      const result = await getUserBySessionId(mockDatabase, "session123");

      expect(mockDatabase.getUserBySessionId).toHaveBeenCalledWith(
        "session123",
      );
      expect(result).toEqual(mockUser);
    });

    it("should return null for invalid session ID", async () => {
      mockDatabase.getUserBySessionId.mockResolvedValue(null);

      const result = await getUserBySessionId(mockDatabase, "invalid");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabase.getUserBySessionId.mockRejectedValue(new Error("DB error"));

      await expect(
        getUserBySessionId(mockDatabase, "session123"),
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

      mockDatabase.getUserSettings.mockResolvedValue(mockSettings);

      const result = await getUserSettings(mockDatabase, 123);

      expect(mockDatabase.getUserSettings).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockSettings);
    });

    it("should return null for invalid user ID", async () => {
      const result = await getUserSettings(mockDatabase, 0);

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabase.getUserSettings.mockRejectedValue(new Error("DB error"));

      await expect(getUserSettings(mockDatabase, 123)).rejects.toThrow(
        new AssistantError(
          "Failed to retrieve user settings",
          ErrorType.UNKNOWN_ERROR,
        ),
      );
    });
  });

  describe("getUserById", () => {
    it("should return user for valid ID", async () => {
      const mockUser = { id: 123, email: "user@example.com" };

      mockDatabase.getUserById.mockResolvedValue(mockUser);

      const result = await getUserById(mockDatabase, 123);

      expect(mockDatabase.getUserById).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockUser);
    });

    it("should return null for non-existent user", async () => {
      mockDatabase.getUserById.mockResolvedValue(null);

      const result = await getUserById(mockDatabase, 999);

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabase.getUserById.mockRejectedValue(new Error("DB error"));

      await expect(getUserById(mockDatabase, 123)).rejects.toMatchObject({
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
      };

      mockDatabase.getUserByGithubId.mockResolvedValue(existingUser);
      mockDatabase.updateUser.mockResolvedValue(true);

      const result = await createOrUpdateGithubUser(mockDatabase, mockUserData);

      expect(mockDatabase.getUserByGithubId).toHaveBeenCalledWith("github123");
      expect(mockDatabase.updateUser).toHaveBeenCalledWith(
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
      const existingEmailUser = { id: 456, email: "user@example.com" };

      mockDatabase.getUserByGithubId.mockResolvedValue(null);
      mockDatabase.getUserByEmail.mockResolvedValue(existingEmailUser);
      mockDatabase.createOauthAccount.mockResolvedValue(true);
      mockDatabase.updateUserWithGithubData.mockResolvedValue(true);

      const result = await createOrUpdateGithubUser(mockDatabase, mockUserData);

      expect(mockDatabase.createOauthAccount).toHaveBeenCalledWith(
        456,
        "github",
        "github123",
      );
      expect(mockDatabase.updateUserWithGithubData).toHaveBeenCalledWith(
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

      mockDatabase.getUserByGithubId.mockResolvedValue(null);
      mockDatabase.getUserByEmail.mockResolvedValue(null);
      mockDatabase.createUser.mockResolvedValue(newUser);
      mockDatabase.createOauthAccount.mockResolvedValue(true);

      const result = await createOrUpdateGithubUser(mockDatabase, mockUserData);

      expect(mockDatabase.createUser).toHaveBeenCalledWith(mockUserData);
      expect(mockDatabase.createOauthAccount).toHaveBeenCalledWith(
        789,
        "github",
        "github123",
      );
      expect(result.id).toBe(789);
    });

    it("should throw error if user creation fails", async () => {
      mockDatabase.getUserByGithubId.mockResolvedValue(null);
      mockDatabase.getUserByEmail.mockResolvedValue(null);
      mockDatabase.createUser.mockResolvedValue(null);

      await expect(
        createOrUpdateGithubUser(mockDatabase, mockUserData),
      ).rejects.toThrow("Failed to create or update user");
    });

    it("should handle database errors", async () => {
      mockDatabase.getUserByGithubId.mockRejectedValue(new Error("DB error"));

      await expect(
        createOrUpdateGithubUser(mockDatabase, mockUserData),
      ).rejects.toMatchObject({
        message: "Failed to create or update user",
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
      mockDatabase.createSession.mockResolvedValue(true);

      const result = await createSession(mockDatabase, 123);

      expect(mockDatabase.createSession).toHaveBeenCalledWith(
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
      mockDatabase.createSession.mockResolvedValue(true);

      await createSession(mockDatabase, 123, 14);

      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 14);

      expect(mockDatabase.createSession).toHaveBeenCalledWith(
        mockSessionId,
        123,
        expect.any(Date),
      );
    });

    it("should handle database errors", async () => {
      vi.stubGlobal("crypto", {
        randomUUID: vi.fn().mockReturnValue("session-uuid"),
      });
      mockDatabase.createSession.mockRejectedValue(new Error("DB error"));

      await expect(createSession(mockDatabase, 123)).rejects.toMatchObject({
        message: "Failed to create session",
        type: ErrorType.UNKNOWN_ERROR,
        name: "AssistantError",
      });
    });
  });

  describe("deleteSession", () => {
    it("should delete session successfully", async () => {
      mockDatabase.deleteSession.mockResolvedValue(true);

      await deleteSession(mockDatabase, "session123");

      expect(mockDatabase.deleteSession).toHaveBeenCalledWith("session123");
    });

    it("should handle database errors", async () => {
      mockDatabase.deleteSession.mockRejectedValue(new Error("DB error"));

      await expect(
        deleteSession(mockDatabase, "session123"),
      ).rejects.toMatchObject({
        message: "Failed to delete session",
        type: ErrorType.UNKNOWN_ERROR,
        name: "AssistantError",
      });
    });
  });
});
