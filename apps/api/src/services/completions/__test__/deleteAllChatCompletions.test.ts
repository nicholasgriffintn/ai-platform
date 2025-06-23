import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeleteAllChatCompletions } from "../deleteAllChatCompletions";

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: vi.fn(),
  },
}));

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: vi.fn(),
  },
}));

const mockEnv = {
  DB: "test-db",
};

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockRequest = {
  env: mockEnv,
  user: mockUser,
};

describe("handleDeleteAllChatCompletions", () => {
  let mockDatabase: any;
  let mockConversationManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { Database } = await import("~/lib/database");
    const { ConversationManager } = await import("~/lib/conversationManager");

    mockDatabase = {
      getUserSettings: vi.fn(),
    };

    mockConversationManager = {
      deleteAllChatCompletions: vi.fn(),
    };

    vi.mocked(Database.getInstance).mockReturnValue(mockDatabase);
    vi.mocked(ConversationManager.getInstance).mockReturnValue(
      mockConversationManager,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parameter validation", () => {
    it("should throw error for missing user ID", async () => {
      const requestWithoutUser = {
        env: mockEnv,
        user: null,
      } as any;

      await expect(() =>
        handleDeleteAllChatCompletions(requestWithoutUser),
      ).rejects.toThrow("User ID is required to delete a conversation");
    });

    it("should throw error for missing database connection", async () => {
      const requestWithoutDB = {
        env: {},
        user: mockUser,
      } as any;

      await expect(() =>
        handleDeleteAllChatCompletions(requestWithoutDB),
      ).rejects.toThrow("Missing database connection");
    });
  });

  describe("successful deletion", () => {
    it("should delete all conversations successfully", async () => {
      mockConversationManager.deleteAllChatCompletions.mockResolvedValue(
        undefined,
      );

      // @ts-expect-error - mock request
      const result = await handleDeleteAllChatCompletions(mockRequest);

      expect(
        mockConversationManager.deleteAllChatCompletions,
      ).toHaveBeenCalledWith("user-123");
      expect(result).toEqual({
        success: true,
        message: "Conversations have been deleted",
      });
    });
  });

  describe("error handling", () => {
    it("should handle deletion errors", async () => {
      mockConversationManager.deleteAllChatCompletions.mockRejectedValue(
        new Error("Deletion failed"),
      );

      await expect(() =>
        // @ts-expect-error - mock request
        handleDeleteAllChatCompletions(mockRequest),
      ).rejects.toThrow("Deletion failed");
    });

    it("should handle database connection errors", async () => {
      const { Database } = await import("~/lib/database");
      vi.mocked(Database.getInstance).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await expect(() =>
        // @ts-expect-error - mock request
        handleDeleteAllChatCompletions(mockRequest),
      ).rejects.toThrow("Database connection failed");
    });
  });
});
