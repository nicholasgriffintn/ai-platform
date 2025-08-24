import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderFactory } from "~/lib/providers/factory";
import { parseAIResponseJson } from "~/utils/json";
import { MemoryManager } from "../memory";

vi.mock("~/lib/embedding", () => ({
  Embedding: {
    getInstance: vi.fn(() => ({
      generate: vi
        .fn()
        .mockResolvedValue([{ values: [0.1, 0.2, 0.3], id: "test-id" }]),
      getMatches: vi.fn().mockResolvedValue({ matches: [] }),
      getQuery: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }),
      insert: vi.fn().mockResolvedValue(undefined),
    })),
  },
  EmbeddingSingleton: {
    getInstance: vi.fn(() => ({
      generate: vi
        .fn()
        .mockResolvedValue([{ values: [0.1, 0.2, 0.3], id: "test-id" }]),
      getMatches: vi.fn().mockResolvedValue({ matches: [] }),
      getQuery: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }),
      insert: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => ({
      getResponse: vi.fn(),
      name: "test-provider",
      supportsStreaming: false,
      createRealtimeSession: vi.fn(),
    })),
  },
}));

vi.mock("~/lib/models", () => ({
  getAuxiliaryModel: vi.fn().mockResolvedValue({
    model: "gpt-3.5-turbo",
    provider: "openai",
  }),
}));

vi.mock("~/utils/json", () => ({
  parseAIResponseJson: vi.fn(),
}));

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: () => ({
      getConversation: vi.fn(),
      createConversation: vi.fn(),
    }),
  },
  DatabaseSingleton: {
    getInstance: () => ({
      getConversation: vi.fn(),
      createConversation: vi.fn(),
    }),
  },
}));

describe("MemoryManager", () => {
  const mockEnv = { OPENAI_API_KEY: "test-key" } as any;
  const mockUser = { id: 1, email: "test@example.com" } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    MemoryManager["instance"] = undefined as any;
  });

  describe("getInstance", () => {
    it("should create singleton instance", () => {
      const instance1 = MemoryManager.getInstance(mockEnv, mockUser);
      const instance2 = MemoryManager.getInstance(mockEnv, mockUser);
      expect(instance1).toBe(instance2);
    });
  });

  describe("handleMemory - main bug fix tests", () => {
    it("should process memories when memories_save_enabled is true", async () => {
      const userSettings = {
        memories_save_enabled: true,
        memories_chat_history_enabled: false,
      };

      const messages = [
        { role: "user", content: "I love Python programming" },
      ] as any;

      const mockProvider = {
        getResponse: vi
          .fn()
          .mockResolvedValueOnce({
            response: JSON.stringify({
              storeMemory: true,
              category: "preference",
              summary: "User loves Python programming",
            }),
          })
          .mockResolvedValueOnce({
            response: JSON.stringify([
              "The user enjoys Python programming",
              "Python is preferred by the user for programming",
            ]),
          }),
        name: "test-provider",
        supportsStreaming: false,
        createRealtimeSession: vi.fn(),
      };
      vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

      vi.mocked(parseAIResponseJson)
        .mockReturnValueOnce({
          data: {
            storeMemory: true,
            category: "preference",
            summary: "User loves Python programming",
          },
          error: null,
        })
        .mockReturnValueOnce({
          data: [
            "The user enjoys Python programming",
            "Python is preferred by the user for programming",
          ],
          error: null,
        });

      const manager = MemoryManager.getInstance(mockEnv, mockUser);
      const mockConversationManager = { get: vi.fn() } as any;

      vi.spyOn(manager, "storeMemory").mockResolvedValue("mock-id");

      const result = await manager.handleMemory(
        "I love Python programming",
        messages,
        mockConversationManager,
        "completion-123",
        userSettings as any,
      );

      expect(result).toEqual([
        {
          type: "store",
          text: "User loves Python programming",
          category: "preference",
        },
      ]);
    });

    it("should handle chat history snapshots when enabled", async () => {
      const userSettings = {
        memories_save_enabled: false,
        memories_chat_history_enabled: true,
      };

      const messages = [
        { role: "user", content: "Message 0" },
        { role: "assistant", content: "Response 0" },
        { role: "user", content: "Message 1" },
        { role: "assistant", content: "Response 1" },
        { role: "user", content: "Message 2" },
        { role: "assistant", content: "Response 2" },
        { role: "user", content: "Message 3" },
        { role: "assistant", content: "Response 3" },
        { role: "user", content: "Message 4" },
      ] as any;

      const mockConversationManager = {
        get: vi.fn().mockResolvedValue(messages),
      };

      const mockProvider = {
        getResponse: vi.fn().mockResolvedValue({
          response: "Summary of recent conversation",
        }),
        name: "test-provider",
        supportsStreaming: false,
        createRealtimeSession: vi.fn(),
      };
      vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

      const manager = MemoryManager.getInstance(mockEnv, mockUser);

      vi.spyOn(manager, "storeMemory").mockResolvedValue("mock-id");

      const result = await manager.handleMemory(
        "test message",
        messages,
        mockConversationManager as any,
        "completion-123",
        userSettings as any,
      );

      expect(result).toEqual([
        {
          type: "snapshot",
          text: "Summary of recent conversation",
          category: "snapshot",
        },
      ]);
    });

    it("should return empty array when both settings are disabled", async () => {
      const userSettings = {
        memories_save_enabled: false,
        memories_chat_history_enabled: false,
      };

      const messages = [{ role: "user", content: "test" }] as any;
      const mockConversationManager = { get: vi.fn() } as any;

      const manager = MemoryManager.getInstance(mockEnv, mockUser);

      const result = await manager.handleMemory(
        "test message",
        messages,
        mockConversationManager,
        "completion-123",
        userSettings as any,
      );

      expect(result).toEqual([]);
    });

    it("should handle AI provider errors gracefully", async () => {
      const userSettings = {
        memories_save_enabled: true,
        memories_chat_history_enabled: false,
      };

      const messages = [{ role: "user", content: "test" }] as any;

      const mockProvider = {
        getResponse: vi.fn().mockRejectedValue(new Error("AI API error")),
        name: "test-provider",
        supportsStreaming: false,
        createRealtimeSession: vi.fn(),
      };
      vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

      const manager = MemoryManager.getInstance(mockEnv, mockUser);
      const mockConversationManager = { get: vi.fn() } as any;

      const result = await manager.handleMemory(
        "test message",
        messages,
        mockConversationManager,
        "completion-123",
        userSettings as any,
      );

      expect(result).toEqual([]);
    });
  });
});
