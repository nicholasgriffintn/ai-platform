import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuxiliaryModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import { handleWebSearch } from "~/services/search/web";
import { performDeepWebSearch } from "../web-search";

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/lib/models", () => ({
  getAuxiliaryModel: vi.fn(() =>
    Promise.resolve({ model: "gpt-4o-mini", provider: "openai" }),
  ),
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => ({
      getResponse: vi.fn(() =>
        Promise.resolve({
          response: { questions: ["Related question 1", "Related question 2"] },
        }),
      ),
    })),
  },
}));

vi.mock("~/services/search/web", () => ({
  handleWebSearch: vi.fn(() =>
    Promise.resolve({
      data: {
        results: [
          {
            title: "Search Result 1",
            url: "https://example.com/1",
            content: "Content from first result",
            score: 0.95,
          },
          {
            title: "Search Result 2",
            url: "https://example.com/2",
            content: "Content from second result",
            score: 0.87,
          },
        ],
      },
    }),
  ),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "generated-id-123"),
}));

vi.mock("~/utils/errors", () => ({
  AssistantError: class extends Error {
    type: string;
    constructor(message: string, type?: string) {
      super(message);
      this.type = type || "UNKNOWN";
    }
  },
  ErrorType: {
    PARAMS_ERROR: "PARAMS_ERROR",
  },
}));

describe("performDeepWebSearch", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    plan: "free",
    created_at: Date.now(),
  } as any;

  const mockEnv = {
    TAVILY_API_KEY: "test-tavily-key",
  } as any;

  const mockConversationManager = {
    add: vi.fn(),
    updateConversation: vi.fn(),
  } as any;

  const mockProvider = {
    getResponse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - mockProvider is missing required properties
    vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);
    vi.mocked(getAuxiliaryModel).mockResolvedValue({
      model: "gpt-4o-mini",
      provider: "openai",
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should perform deep web search successfully", async () => {
    const body = {
      query: "artificial intelligence trends",
      options: {
        search_depth: "advanced" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
      completion_id: "completion-123",
    };

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: ["What is AI?", "Future of AI?"] },
      })
      .mockResolvedValueOnce({
        response: "AI is revolutionizing technology...",
      });

    const result = await performDeepWebSearch(
      mockEnv,
      mockUser,
      body,
      mockConversationManager,
    );

    expect(result).toEqual({
      answer: "AI is revolutionizing technology...",
      similarQuestions: ["What is AI?", "Future of AI?"],
      sources: [
        {
          title: "Search Result 1",
          url: "https://example.com/1",
          content: "Content from first result",
          score: 0.95,
        },
        {
          title: "Search Result 2",
          url: "https://example.com/2",
          content: "Content from second result",
          score: 0.87,
        },
      ],
      completion_id: "completion-123-tutor",
    });

    expect(handleWebSearch).toHaveBeenCalledWith({
      query: "artificial intelligence trends",
      provider: "tavily",
      options: {
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
      env: mockEnv,
      user: mockUser,
    });
  });

  it("should handle missing query", async () => {
    const body = {
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    await expect(
      // @ts-ignore - body is missing required properties
      performDeepWebSearch(mockEnv, mockUser, body),
    ).rejects.toThrow("Missing query or options");
  });

  it("should handle missing options", async () => {
    const body = {
      query: "test query",
    };

    await expect(
      performDeepWebSearch(mockEnv, mockUser, body as any),
    ).rejects.toThrow("Missing query or options");
  });

  it("should generate completion ID when not provided", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: [] },
      })
      .mockResolvedValueOnce({
        response: "Test answer",
      });

    const result = await performDeepWebSearch(mockEnv, mockUser, body);

    expect(result.completion_id).toBe("generated-id-123-tutor");
  });

  it("should add messages to conversation manager when provided", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
      completion_id: "test-completion",
    };

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: [] },
      })
      .mockResolvedValueOnce({
        response: "Test answer",
      });

    await performDeepWebSearch(
      mockEnv,
      mockUser,
      body,
      mockConversationManager,
    );

    expect(mockConversationManager.add).toHaveBeenCalledTimes(3);
    expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
      "test-completion-tutor",
      { title: "Web search for test query" },
    );
  });

  it("should handle web search errors", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    vi.mocked(handleWebSearch).mockRejectedValue(
      new Error("Web search failed"),
    );

    await expect(performDeepWebSearch(mockEnv, mockUser, body)).rejects.toThrow(
      "Web search failed",
    );
  });

  it("should handle AI provider errors for similar questions", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    mockProvider.getResponse
      .mockRejectedValueOnce(new Error("AI Provider Error"))
      .mockResolvedValueOnce({
        response: "Test answer",
      });

    await expect(performDeepWebSearch(mockEnv, mockUser, body)).rejects.toThrow(
      "AI Provider Error",
    );
  });

  it("should handle AI provider errors for answer generation", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: [] },
      })
      .mockRejectedValueOnce(new Error("Answer generation failed"));

    await expect(performDeepWebSearch(mockEnv, mockUser, body)).rejects.toThrow(
      "Answer generation failed",
    );
  });

  it("should work without conversation manager", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: [] },
      })
      .mockResolvedValueOnce({
        response: "Test answer",
      });

    const result = await performDeepWebSearch(mockEnv, mockUser, body);

    expect(result).toBeDefined();
    expect(result.answer).toBe("Test answer");
  });

  it("should format sources correctly from web search results", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "basic" as const,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      },
    };

    vi.mocked(handleWebSearch).mockResolvedValue({
      data: {
        results: [
          {
            title: "Custom Result",
            url: "https://custom.com",
            content: "Custom content",
            score: 0.99,
          },
        ],
      },
    });

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: [] },
      })
      .mockResolvedValueOnce({
        response: "Test answer",
      });

    const result = await performDeepWebSearch(mockEnv, mockUser, body);

    expect(result.sources).toEqual([
      {
        title: "Custom Result",
        url: "https://custom.com",
        content: "Custom content",
        score: 0.99,
      },
    ]);
  });

  it("should use correct search options", async () => {
    const body = {
      query: "test query",
      options: {
        search_depth: "advanced" as const,
        include_answer: true,
        include_raw_content: true,
        include_images: true,
      },
    };

    mockProvider.getResponse
      .mockResolvedValueOnce({
        response: { questions: [] },
      })
      .mockResolvedValueOnce({
        response: "Test answer",
      });

    await performDeepWebSearch(mockEnv, mockUser, body);

    expect(handleWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          search_depth: "advanced",
          include_answer: true,
          include_raw_content: true,
          include_images: true,
        },
      }),
    );
  });
});
