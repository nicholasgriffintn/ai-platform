import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoreChatOptions } from "~/types";
import type { ValidationContext } from "../../validation/ValidationPipeline";
import { RequestPreparer } from "../RequestPreparer";

const mockDatabase = {
  getUserSettings: vi.fn(),
};

const mockConversationManager = {
  addBatch: vi.fn(),
  get: vi.fn(),
  replaceMessages: vi.fn(),
};

const mockEmbedding = {
  augmentPrompt: vi.fn(),
};

const mockMemoryManager = {
  retrieveMemories: vi.fn(),
};

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: () => mockDatabase,
  },
}));

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: vi.fn(() => mockConversationManager),
  },
}));

vi.mock("~/lib/embedding", () => ({
  Embedding: {
    getInstance: vi.fn(() => mockEmbedding),
  },
}));

vi.mock("~/lib/memory", () => ({
  MemoryManager: {
    getInstance: vi.fn(() => mockMemoryManager),
  },
}));

vi.mock("~/lib/models", () => ({
  getModelConfig: vi.fn(),
}));

vi.mock("~/lib/prompts", () => ({
  getSystemPrompt: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(),
}));

vi.mock("~/lib/chat/utils", () => ({
  getAllAttachments: vi.fn(),
  sanitiseInput: vi.fn(),
  pruneMessagesToFitContext: vi.fn(),
}));

describe("RequestPreparer", () => {
  let preparer: RequestPreparer;
  let mockEnv: any;
  let baseOptions: CoreChatOptions;
  let baseValidationContext: ValidationContext;
  let mockModelConfig: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockEnv = {
      AI: {},
      VECTOR_DB: {},
      AWS_REGION: "us-east-1",
    };

    mockModelConfig = {
      matchingModel: "claude-3-sonnet",
      provider: "anthropic",
      name: "Claude 3 Sonnet",
      contextWindow: 8000,
    };

    preparer = new RequestPreparer(mockEnv);

    // @ts-expect-error - mock implementation
    baseOptions = {
      env: mockEnv,
      user: {
        id: "user-123",
        email: "test@example.com",
        plan_id: "pro",
      },
      completion_id: "completion-123",
      platform: "api",
      mode: "normal",
    } as CoreChatOptions;

    baseValidationContext = {
      sanitizedMessages: [
        {
          role: "user",
          content: "Hello world",
          id: "msg-1",
          timestamp: Date.now(),
        },
      ],
      lastMessage: {
        role: "user",
        content: "Hello world",
        id: "msg-1",
        timestamp: Date.now(),
      },
      modelConfig: mockModelConfig,
      selectedModels: ["claude-3-sonnet"],
      messageWithContext: "Hello world",
    } as ValidationContext;

    mockDatabase.getUserSettings.mockResolvedValue({
      embedding_provider: "vectorize",
      memories_save_enabled: true,
    });

    const { getModelConfig } = await import("~/lib/models");
    const { getSystemPrompt } = await import("~/lib/prompts");
    const { generateId } = await import("~/utils/id");
    const { getAllAttachments, sanitiseInput, pruneMessagesToFitContext } =
      await import("~/lib/chat/utils");

    vi.mocked(getModelConfig).mockResolvedValue(mockModelConfig);
    vi.mocked(getSystemPrompt).mockResolvedValue("Generated system prompt");
    vi.mocked(generateId).mockReturnValue("test-id-123");
    vi.mocked(getAllAttachments).mockReturnValue({
      allAttachments: [],
      imageAttachments: [],
      documentAttachments: [],
      markdownAttachments: [],
    });
    vi.mocked(sanitiseInput).mockImplementation((input) => input);
    vi.mocked(pruneMessagesToFitContext).mockImplementation(
      (messages) => messages,
    );
  });

  describe("prepare", () => {
    it("should prepare request successfully with all required data", async () => {
      const result = await preparer.prepare(baseOptions, baseValidationContext);

      expect(result).toEqual({
        modelConfigs: [
          {
            model: "claude-3-sonnet",
            provider: "anthropic",
            displayName: "Claude 3 Sonnet",
          },
        ],
        primaryModel: "claude-3-sonnet",
        primaryModelConfig: mockModelConfig,
        primaryProvider: "anthropic",
        conversationManager: mockConversationManager,
        messages: expect.any(Array),
        systemPrompt: expect.any(String),
        messageWithContext: "Hello world",
        userSettings: expect.any(Object),
        currentMode: "normal",
        isProUser: true,
      });
    });

    it("should throw error when validation context is missing required fields", async () => {
      const invalidContext = {
        ...baseValidationContext,
        sanitizedMessages: null,
      } as any;

      await expect(
        preparer.prepare(baseOptions, invalidContext),
      ).rejects.toThrow("Missing required validation context");
    });

    it("should handle anonymous user properly", async () => {
      const anonymousOptions = {
        ...baseOptions,
        user: undefined,
        anonymousUser: { id: "anon-123" },
      };

      const result = await preparer.prepare(
        anonymousOptions,
        baseValidationContext,
      );

      expect(result.isProUser).toBe(false);
    });

    it("should handle free user properly", async () => {
      const freeUserOptions = {
        ...baseOptions,
        user: { ...baseOptions.user!, plan_id: "free" },
      };

      const result = await preparer.prepare(
        freeUserOptions,
        baseValidationContext,
      );

      expect(result.isProUser).toBe(false);
    });
  });

  describe("buildModelConfigs", () => {
    it("should build model configs from selected models", async () => {
      const result = await (preparer as any).buildModelConfigs(
        baseOptions,
        baseValidationContext,
      );

      expect(result).toEqual([
        {
          model: "claude-3-sonnet",
          provider: "anthropic",
          displayName: "Claude 3 Sonnet",
        },
      ]);
    });

    it("should throw error when no selected models", async () => {
      const contextWithoutModels = {
        ...baseValidationContext,
        selectedModels: [],
      };

      await expect(
        (preparer as any).buildModelConfigs(baseOptions, contextWithoutModels),
      ).rejects.toThrow("No selected models available from validation context");
    });

    it("should throw error when model config is invalid", async () => {
      const { getModelConfig } = await import("~/lib/models");
      vi.mocked(getModelConfig).mockResolvedValue(null);

      await expect(
        (preparer as any).buildModelConfigs(baseOptions, baseValidationContext),
      ).rejects.toThrow("No valid model configurations available");
    });
  });

  describe("processMessageContent", () => {
    it("should return sanctioned message when RAG is disabled", async () => {
      const result = await (preparer as any).processMessageContent(
        baseOptions,
        baseValidationContext,
        {},
      );

      expect(result).toBe("Hello world");
    });

    it("should augment prompt with RAG when enabled", async () => {
      const ragOptions = {
        ...baseOptions,
        use_rag: true,
        rag_options: { topK: 5 },
      };
      mockEmbedding.augmentPrompt.mockResolvedValue("Augmented prompt");

      const result = await (preparer as any).processMessageContent(
        ragOptions,
        baseValidationContext,
        { embedding_provider: "vectorize" },
      );

      expect(result).toBe("Augmented prompt");
      expect(mockEmbedding.augmentPrompt).toHaveBeenCalledWith(
        "Hello world",
        { topK: 5 },
        mockEnv,
        "user-123",
      );
    });

    it("should handle array content in last message", async () => {
      const contextWithArrayContent = {
        ...baseValidationContext,
        lastMessage: {
          role: "user",
          content: [
            { type: "text", text: "Array message" },
            { type: "image_url", image_url: { url: "test.jpg" } },
          ],
        },
      };

      const result = await (preparer as any).processMessageContent(
        baseOptions,
        contextWithArrayContent,
        {},
      );

      expect(result).toBe("Array message");
    });
  });

  describe("storeMessages", () => {
    const mockConversationManagerInstance = mockConversationManager;

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    it("should store message without attachments", async () => {
      const lastMessage = { role: "user", content: "Test message" };

      await (preparer as any).storeMessages(
        baseOptions,
        mockConversationManagerInstance,
        lastMessage,
        "Test message",
        "claude-3-sonnet",
        "api",
        "normal",
      );

      expect(mockConversationManagerInstance.addBatch).toHaveBeenCalledWith(
        "completion-123",
        [
          {
            role: "user",
            content: "Test message",
            id: "test-id-123",
            timestamp: 1234567890,
            model: "claude-3-sonnet",
            platform: "api",
            mode: "normal",
          },
        ],
        {
          metadata: expect.any(Object),
        },
      );
    });

    it("should store message with attachments", async () => {
      const { getAllAttachments } = await import("~/lib/chat/utils");
      vi.mocked(getAllAttachments).mockReturnValueOnce({
        allAttachments: [{ type: "image", url: "test.jpg" }],
        imageAttachments: [{ type: "image", url: "test.jpg" }],
        documentAttachments: [],
        markdownAttachments: [],
      });

      const lastMessage = {
        role: "user",
        content: [{ type: "text", text: "Message with image" }],
      };

      await (preparer as any).storeMessages(
        baseOptions,
        mockConversationManagerInstance,
        lastMessage,
        "Message with image",
        "claude-3-sonnet",
        "api",
        "normal",
      );

      expect(mockConversationManagerInstance.addBatch).toHaveBeenCalledWith(
        "completion-123",
        expect.arrayContaining([
          expect.objectContaining({
            content: "Message with image",
          }),
          expect.objectContaining({
            content: "Attachments",
            data: { attachments: [{ type: "image", url: "test.jpg" }] },
          }),
        ]),
        {
          metadata: expect.any(Object),
        },
      );
    });

    it("should use replaceMessages when existing messages exceed incoming messages (retry scenario)", async () => {
      mockConversationManagerInstance.get.mockResolvedValueOnce([
        { id: "1", role: "user", content: "First message" },
        { id: "2", role: "assistant", content: "First response" },
        { id: "3", role: "user", content: "Second message" },
        { id: "4", role: "assistant", content: "Second response" },
      ]);

      const optionsWithRetry = {
        ...baseOptions,
        messages: [
          { id: "1", role: "user", content: "First message" },
          { id: "2", role: "assistant", content: "First response" },
        ],
      };

      const lastMessage = { role: "user", content: "Test message" };

      await (preparer as any).storeMessages(
        optionsWithRetry,
        mockConversationManagerInstance,
        lastMessage,
        "Test message",
        "claude-3-sonnet",
        "api",
        "normal",
      );

      expect(
        mockConversationManagerInstance.replaceMessages,
      ).toHaveBeenCalledWith("completion-123", optionsWithRetry.messages);
      expect(mockConversationManagerInstance.addBatch).not.toHaveBeenCalled();
    });

    it("should use addBatch when existing messages are less than or equal to incoming messages (normal scenario)", async () => {
      mockConversationManagerInstance.get.mockResolvedValueOnce([
        { id: "1", role: "user", content: "First message" },
      ]);

      const optionsWithNormal = {
        ...baseOptions,
        messages: [
          { id: "1", role: "user", content: "First message" },
          { id: "2", role: "user", content: "Second message" },
        ],
      };

      const lastMessage = { role: "user", content: "Test message" };

      await (preparer as any).storeMessages(
        optionsWithNormal,
        mockConversationManagerInstance,
        lastMessage,
        "Test message",
        "claude-3-sonnet",
        "api",
        "normal",
      );

      expect(mockConversationManagerInstance.addBatch).toHaveBeenCalledWith(
        "completion-123",
        [
          {
            role: "user",
            content: "Test message",
            id: "test-id-123",
            timestamp: 1234567890,
            model: "claude-3-sonnet",
            platform: "api",
            mode: "normal",
          },
        ],
        {
          metadata: expect.any(Object),
        },
      );
      expect(
        mockConversationManagerInstance.replaceMessages,
      ).not.toHaveBeenCalled();
    });

    it("should store metadata when provided", async () => {
      const optionsWithMetadata = {
        ...baseOptions,
        metadata: { key: "value" },
      };

      const lastMessage = { role: "user", content: "Test message" };

      await (preparer as any).storeMessages(
        optionsWithMetadata,
        mockConversationManagerInstance,
        lastMessage,
        "Test message",
        "claude-3-sonnet",
        "api",
        "normal",
      );

      expect(mockConversationManagerInstance.addBatch).toHaveBeenCalledWith(
        "completion-123",
        [
          {
            content: "Test message",
            id: "test-id-123",
            mode: "normal",
            model: "claude-3-sonnet",
            platform: "api",
            role: "user",
            timestamp: 1234567890,
          },
        ],
        { metadata: { key: "value" } },
      );
    });

    it("should default metadata to empty object when undefined", async () => {
      const lastMessage = { role: "user", content: "Test message" };

      await (preparer as any).storeMessages(
        baseOptions,
        mockConversationManagerInstance,
        lastMessage,
        "Test message",
        "claude-3-sonnet",
        "api",
        "normal",
      );

      expect(mockConversationManagerInstance.addBatch).toHaveBeenCalledWith(
        "completion-123",
        [
          {
            role: "user",
            content: "Test message",
            id: "test-id-123",
            timestamp: 1234567890,
            model: "claude-3-sonnet",
            platform: "api",
            mode: "normal",
          },
        ],
        {
          metadata: expect.any(Object),
        },
      );
    });
  });

  describe("buildSystemPrompt", () => {
    it("should return empty string for no_system mode", async () => {
      const noSystemOptions = { ...baseOptions, mode: "no_system" };

      const result = await (preparer as any).buildSystemPrompt(
        noSystemOptions,
        [],
        "test message",
        "claude-3-sonnet",
        {},
      );

      expect(result).toBe("");
    });

    it("should use provided system_prompt", async () => {
      const systemPromptOptions = {
        ...baseOptions,
        system_prompt: "Custom system prompt",
      };

      const result = await (preparer as any).buildSystemPrompt(
        systemPromptOptions,
        [],
        "test message",
        "claude-3-sonnet",
        {},
      );

      expect(result).toBe("Custom system prompt");
    });

    it("should use system message from sanitized messages", async () => {
      const messagesWithSystem = [
        {
          role: "system",
          content: "System message from conversation",
          id: "sys-1",
          timestamp: Date.now(),
        },
        ...baseValidationContext.sanitizedMessages!,
      ];

      const result = await (preparer as any).buildSystemPrompt(
        baseOptions,
        messagesWithSystem,
        "test message",
        "claude-3-sonnet",
        {},
      );

      expect(result).toBe("System message from conversation");
    });

    it("should generate system prompt when none provided", async () => {
      const result = await (preparer as any).buildSystemPrompt(
        baseOptions,
        [],
        "test message",
        "claude-3-sonnet",
        {},
      );

      expect(result).toBe("Generated system prompt");
    });
  });

  describe("enhanceSystemPromptWithMemory", () => {
    it("should enhance prompt with memories for pro user", async () => {
      mockMemoryManager.retrieveMemories.mockResolvedValue([
        { text: "User likes coffee" },
        { text: "User works in tech" },
      ]);

      const result = await (preparer as any).enhanceSystemPromptWithMemory(
        "Base prompt",
        "test message",
        { id: "user-123", plan_id: "pro" },
        { memories_save_enabled: true },
      );

      expect(result).toContain("Base prompt");
      expect(result).toContain(
        "You have access to the following long-term memories:",
      );
      expect(result).toContain("- User likes coffee");
      expect(result).toContain("- User works in tech");
    });

    it("should not enhance prompt for free user", async () => {
      const result = await (preparer as any).enhanceSystemPromptWithMemory(
        "Base prompt",
        "test message",
        { id: "user-123", plan_id: "free" },
        { memories_save_enabled: true },
      );

      expect(result).toBe("Base prompt");
      expect(mockMemoryManager.retrieveMemories).not.toHaveBeenCalled();
    });

    it("should not enhance prompt when memories disabled", async () => {
      const result = await (preparer as any).enhanceSystemPromptWithMemory(
        "Base prompt",
        "test message",
        { id: "user-123", plan_id: "pro" },
        { memories_save_enabled: false },
      );

      expect(result).toBe("Base prompt");
      expect(mockMemoryManager.retrieveMemories).not.toHaveBeenCalled();
    });

    it("should handle memory retrieval errors gracefully", async () => {
      mockMemoryManager.retrieveMemories.mockRejectedValue(
        new Error("Memory error"),
      );

      const result = await (preparer as any).enhanceSystemPromptWithMemory(
        "Base prompt",
        "test message",
        { id: "user-123", plan_id: "pro" },
        { memories_save_enabled: true },
      );

      expect(result).toBe("Base prompt");
    });

    it("should return memory block when no base prompt provided", async () => {
      mockMemoryManager.retrieveMemories.mockResolvedValue([
        { text: "User prefers short responses" },
      ]);

      const result = await (preparer as any).enhanceSystemPromptWithMemory(
        "",
        "test message",
        { id: "user-123", plan_id: "pro" },
        { memories_save_enabled: true },
      );

      expect(result).toContain(
        "You have access to the following long-term memories:",
      );
      expect(result).toContain("- User prefers short responses");
      expect(result).not.toContain("Base prompt");
    });
  });

  describe("buildFinalMessages", () => {
    it("should build final messages with context", () => {
      const sanitizedMessages = [
        {
          role: "system",
          content: "System message",
          id: "sys-1",
          timestamp: Date.now(),
        },
        {
          role: "user",
          content: "Previous message",
          id: "msg-1",
          timestamp: Date.now(),
        },
        {
          role: "assistant",
          content: "Assistant response",
          id: "msg-2",
          timestamp: Date.now(),
        },
      ];

      const result = (preparer as any).buildFinalMessages(
        sanitizedMessages,
        "New message with context",
        mockModelConfig,
      );

      expect(result).toHaveLength(2);
      expect(result.find((msg) => msg.role === "system")).toBeUndefined();
      expect(result[result.length - 1].content).toBe(
        "New message with context",
      );
    });

    it("should handle empty messages array", () => {
      const result = (preparer as any).buildFinalMessages(
        [],
        "New message",
        mockModelConfig,
      );

      expect(result).toEqual([]);
    });
  });
});
