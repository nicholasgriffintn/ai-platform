import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeleteChatCompletion } from "../deleteChatCompletion";

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

describe("handleDeleteChatCompletion", () => {
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
      updateConversation: vi.fn(),
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
        handleDeleteChatCompletion(requestWithoutUser, "completion-123"),
      ).rejects.toThrow("User ID is required to delete a conversation");
    });

    it("should throw error for missing database connection", async () => {
      const requestWithoutDB = {
        env: {},
        user: mockUser,
      } as any;

      await expect(() =>
        handleDeleteChatCompletion(requestWithoutDB, "completion-123"),
      ).rejects.toThrow("Missing database connection");
    });
  });

  describe("successful conversation deletion", () => {
    it("should archive conversation successfully", async () => {
      const completionId = "completion-123";

      mockConversationManager.updateConversation.mockResolvedValue(undefined);

      const result = await handleDeleteChatCompletion(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
      );

      expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
        completionId,
        {
          archived: true,
        },
      );
      expect(result).toEqual({
        success: true,
        message: "Conversation has been archived",
      });
    });

    it("should handle empty completion ID", async () => {
      mockConversationManager.updateConversation.mockResolvedValue(undefined);

      // @ts-expect-error - mock request
      const result = await handleDeleteChatCompletion(mockRequest, "");

      expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
        "",
        {
          archived: true,
        },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle conversation not found", async () => {
      const completionId = "nonexistent-completion";

      mockConversationManager.updateConversation.mockRejectedValue(
        new Error("Conversation not found"),
      );

      await expect(() =>
        // @ts-expect-error - mock request
        handleDeleteChatCompletion(mockRequest, completionId),
      ).rejects.toThrow("Conversation not found");
    });

    it("should handle database connection errors", async () => {
      const { Database } = await import("~/lib/database");
      vi.mocked(Database.getInstance).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await expect(() =>
        // @ts-expect-error - mock request
        handleDeleteChatCompletion(mockRequest, "completion-123"),
      ).rejects.toThrow("Database connection failed");
    });
  });
});
