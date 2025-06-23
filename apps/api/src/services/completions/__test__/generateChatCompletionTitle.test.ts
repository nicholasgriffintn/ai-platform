import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleGenerateChatCompletionTitle } from "../generateChatCompletionTitle";

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

vi.mock("~/lib/models", () => ({
  getAuxiliaryModel: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(),
  },
}));

vi.mock("~/lib/chat/utils", () => ({
  sanitiseMessages: vi.fn(),
}));

const mockEnv = {
  DB: "test-db",
  AI: "test-ai",
};

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockRequest = {
  env: mockEnv,
  user: mockUser,
};

describe("handleGenerateChatCompletionTitle", () => {
  let mockDatabase: any;
  let mockConversationManager: any;
  let mockGetAuxiliaryModel: any;
  let mockAIProviderFactory: any;
  let mockSanitiseMessages: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { Database } = await import("~/lib/database");
    const { ConversationManager } = await import("~/lib/conversationManager");
    const { getAuxiliaryModel } = await import("~/lib/models");
    const { AIProviderFactory } = await import("~/lib/providers/factory");
    const { sanitiseMessages } = await import("~/lib/chat/utils");

    mockDatabase = {
      getUserSettings: vi.fn(),
    };

    mockConversationManager = {
      get: vi.fn(),
      updateConversation: vi.fn(),
    };

    mockGetAuxiliaryModel = vi.mocked(getAuxiliaryModel);
    mockAIProviderFactory = vi.mocked(AIProviderFactory);
    mockSanitiseMessages = vi.mocked(sanitiseMessages);

    vi.mocked(Database.getInstance).mockReturnValue(mockDatabase);
    vi.mocked(ConversationManager.getInstance).mockReturnValue(
      mockConversationManager,
    );

    mockGetAuxiliaryModel.mockResolvedValue({
      model: "test-model",
      provider: "test-provider",
    });

    mockAIProviderFactory.getProvider.mockReturnValue({
      getResponse: vi.fn().mockResolvedValue({
        response: "Generated Title",
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parameter validation", () => {
    it("should throw error for missing AI binding", async () => {
      const requestWithoutAI = {
        env: { DB: "test-db" },
        user: mockUser,
      } as any;

      await expect(() =>
        handleGenerateChatCompletionTitle(requestWithoutAI, "completion-123"),
      ).rejects.toThrow("AI binding is not available");
    });

    it("should throw error for missing DB binding", async () => {
      const requestWithoutDB = {
        env: { AI: "test-ai" },
        user: mockUser,
      } as any;

      await expect(() =>
        handleGenerateChatCompletionTitle(requestWithoutDB, "completion-123"),
      ).rejects.toThrow("Missing DB binding");
    });

    it("should throw error for missing user", async () => {
      const requestWithoutUser = {
        env: mockEnv,
        user: null,
      } as any;

      await expect(() =>
        handleGenerateChatCompletionTitle(requestWithoutUser, "completion-123"),
      ).rejects.toThrow("Authentication required");
    });
  });

  describe("successful title generation", () => {
    it("should generate title with provided messages", async () => {
      const completionId = "completion-123";
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      mockConversationManager.get.mockResolvedValue([]);
      mockSanitiseMessages.mockReturnValue(messages);

      const result = await handleGenerateChatCompletionTitle(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
        messages,
      );

      expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
        completionId,
        { title: "Generated Title" },
      );
      expect(result).toEqual({ title: "Generated Title" });
    });

    it("should generate title from conversation messages when no messages provided", async () => {
      const completionId = "completion-123";
      const conversationMessages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ];

      mockConversationManager.get
        .mockResolvedValueOnce([]) // First call for conversation check
        .mockResolvedValueOnce(conversationMessages); // Second call for message retrieval

      const result = await handleGenerateChatCompletionTitle(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
      );

      expect(result).toEqual({ title: "Generated Title" });
    });

    it("should return default title for empty conversation", async () => {
      const completionId = "completion-empty";

      mockConversationManager.get
        .mockResolvedValueOnce([]) // First call for conversation check
        .mockResolvedValueOnce([]); // Second call returns empty messages

      const result = await handleGenerateChatCompletionTitle(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
      );

      expect(result).toEqual({ title: "New Conversation" });
    });

    it("should trim quotes from generated title", async () => {
      const completionId = "completion-123";
      const messages = [{ role: "user", content: "Test" }];

      mockConversationManager.get.mockResolvedValue([]);
      mockSanitiseMessages.mockReturnValue(messages);

      const mockProvider = mockAIProviderFactory.getProvider();
      mockProvider.getResponse.mockResolvedValue({
        response: '"Quoted Title"',
      });

      const result = await handleGenerateChatCompletionTitle(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
        messages,
      );

      expect(result).toEqual({ title: "Quoted Title" });
    });

    it("should truncate long titles", async () => {
      const completionId = "completion-123";
      const messages = [{ role: "user", content: "Test" }];
      const longTitle = "A".repeat(60);

      mockConversationManager.get.mockResolvedValue([]);
      mockSanitiseMessages.mockReturnValue(messages);

      const mockProvider = mockAIProviderFactory.getProvider();
      mockProvider.getResponse.mockResolvedValue({
        response: longTitle,
      });

      const result = await handleGenerateChatCompletionTitle(
        // @ts-expect-error - mock request
        mockRequest,
        completionId,
        messages,
      );

      expect(result.title).toMatch(/^A{47}\.\.\.$/);
    });
  });

  describe("error handling", () => {
    it("should handle conversation not found", async () => {
      const completionId = "nonexistent";

      mockConversationManager.get.mockRejectedValue(new Error("Not found"));

      await expect(() =>
        // @ts-expect-error - mock request
        handleGenerateChatCompletionTitle(mockRequest, completionId),
      ).rejects.toThrow(
        "Conversation not found or you don't have access to it",
      );
    });

    it("should handle AI provider errors", async () => {
      const completionId = "completion-123";
      const messages = [{ role: "user", content: "Test" }];

      mockConversationManager.get.mockResolvedValue([]);
      mockSanitiseMessages.mockReturnValue(messages);

      const mockProvider = mockAIProviderFactory.getProvider();
      mockProvider.getResponse.mockRejectedValue(
        new Error("AI provider failed"),
      );

      await expect(() =>
        // @ts-expect-error - mock request
        handleGenerateChatCompletionTitle(mockRequest, completionId, messages),
      ).rejects.toThrow("AI provider failed");
    });

    it("should handle database connection errors", async () => {
      const { Database } = await import("~/lib/database");
      vi.mocked(Database.getInstance).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await expect(() =>
        // @ts-expect-error - mock request
        handleGenerateChatCompletionTitle(mockRequest, "completion-123"),
      ).rejects.toThrow("Database connection failed");
    });
  });
});
