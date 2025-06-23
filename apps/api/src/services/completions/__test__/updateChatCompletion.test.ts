import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUpdateChatCompletion } from "../updateChatCompletion";

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

describe("handleUpdateChatCompletion", () => {
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
        handleUpdateChatCompletion(requestWithoutUser, "completion-123", {
          title: "Test",
        }),
      ).rejects.toThrow("User ID is required to update a conversation");
    });

    it("should throw error for missing database connection", async () => {
      const requestWithoutDB = {
        env: {},
        user: mockUser,
      } as any;

      await expect(() =>
        handleUpdateChatCompletion(requestWithoutDB, "completion-123", {
          title: "Test",
        }),
      ).rejects.toThrow("Missing database connection");
    });
  });

  describe("successful updates", () => {
    it("should update conversation title successfully", async () => {
      const completionId = "completion-123";
      const updates = { title: "New Title" };
      const mockResult = {
        id: completionId,
        title: "New Title",
        updated_at: new Date().toISOString(),
      };

      mockConversationManager.updateConversation.mockResolvedValue(mockResult);

      const result = await handleUpdateChatCompletion(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
        updates,
      );

      expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
        completionId,
        updates,
      );
      expect(result).toEqual(mockResult);
    });

    it("should update conversation archived status", async () => {
      const completionId = "completion-456";
      const updates = { archived: true };
      const mockResult = {
        id: completionId,
        archived: true,
        updated_at: new Date().toISOString(),
      };

      mockConversationManager.updateConversation.mockResolvedValue(mockResult);

      const result = await handleUpdateChatCompletion(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
        updates,
      );

      expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
        completionId,
        updates,
      );
      expect(result.archived).toBe(true);
    });

    it("should handle empty completion ID", async () => {
      const updates = { title: "Test" };
      const mockResult = {
        id: "",
        title: "Test",
      };

      mockConversationManager.updateConversation.mockResolvedValue(mockResult);

      // @ts-expect-error - mock request
      const result = await handleUpdateChatCompletion(mockRequest, "", updates);

      expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
        "",
        updates,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("error handling", () => {
    it("should handle conversation not found errors", async () => {
      const completionId = "nonexistent";
      const updates = { title: "New Title" };

      mockConversationManager.updateConversation.mockRejectedValue(
        new Error("Conversation not found"),
      );

      await expect(() =>
        // @ts-expect-error - mock request
        handleUpdateChatCompletion(mockRequest, completionId, updates),
      ).rejects.toThrow("Conversation not found");
    });

    it("should handle database connection errors", async () => {
      const { Database } = await import("~/lib/database");
      vi.mocked(Database.getInstance).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await expect(() =>
        // @ts-expect-error - mock request
        handleUpdateChatCompletion(mockRequest, "completion-123", {
          title: "Test",
        }),
      ).rejects.toThrow("Database connection failed");
    });
  });
});
