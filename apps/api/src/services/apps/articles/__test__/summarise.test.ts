import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { summariseArticle } from "../summarise";

const mockUser = {
  id: 123,
  name: "Test User",
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: null,
};

const mockAppDataRepo = {
  createAppDataWithItem: vi.fn(),
};

const mockProvider = {
  name: "test-provider",
  supportsStreaming: false,
  getResponse: vi.fn(),
  createRealtimeSession: vi.fn(),
};

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/lib/models", () => ({
  getAuxiliaryModelForRetrieval: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => mockProvider),
  },
}));

vi.mock("~/repositories/AppDataRepository", () => ({
  AppDataRepository: vi.fn(() => mockAppDataRepo),
}));

vi.mock("~/utils/extract", () => ({
  extractQuotes: vi.fn(() => ["summary quote 1", "summary quote 2"]),
}));

vi.mock("~/utils/verify", () => ({
  verifyQuotes: vi.fn(() => ({
    verified: ["summary quote 1"],
    missing: ["summary quote 2"],
  })),
}));

describe("summariseArticle", () => {
  const mockEnv = {} as any;
  const mockParams = {
    completion_id: "test-completion",
    app_url: "https://example.com",
    env: mockEnv,
    args: {
      article: "This is a long article that needs to be summarized",
      itemId: "test-item-id",
    },
    user: mockUser,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getAuxiliaryModelForRetrieval } = await import("~/lib/models");
    vi.mocked(getAuxiliaryModelForRetrieval).mockResolvedValue({
      model: "test-model",
      provider: "test-provider",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw error when user ID is missing", async () => {
    const userWithoutId = { ...mockUser, id: 0 };

    await expect(
      summariseArticle({ ...mockParams, user: userWithoutId }),
    ).rejects.toThrow(AssistantError);

    await expect(
      summariseArticle({ ...mockParams, user: userWithoutId }),
    ).rejects.toThrow("User ID is required");
  });

  it("should throw error when itemId is missing", async () => {
    const argsWithoutItemId = { ...mockParams.args, itemId: "" };

    await expect(
      summariseArticle({ ...mockParams, args: argsWithoutItemId }),
    ).rejects.toThrow(AssistantError);

    await expect(
      summariseArticle({ ...mockParams, args: argsWithoutItemId }),
    ).rejects.toThrow("Item ID is required");
  });

  it("should throw error when article content is missing", async () => {
    const argsWithoutArticle = { ...mockParams.args, article: "" };

    await expect(
      summariseArticle({ ...mockParams, args: argsWithoutArticle }),
    ).rejects.toThrow(AssistantError);

    await expect(
      summariseArticle({ ...mockParams, args: argsWithoutArticle }),
    ).rejects.toThrow("Article content is required");
  });

  it("should successfully summarise article and save data", async () => {
    const mockSummaryResponse = {
      content: "This is a comprehensive summary of the article",
      response: "This is a comprehensive summary of the article",
      id: "summary-id",
      citations: ["citation1"],
      log_id: "log-123",
    };

    mockProvider.getResponse.mockResolvedValue(mockSummaryResponse);
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "saved-summary-id",
    });

    const result = await summariseArticle(mockParams);

    expect(result).toEqual({
      status: "success",
      message: "Article summarised and saved.",
      appDataId: "saved-summary-id",
      itemId: "test-item-id",
      summary: {
        content: "This is a comprehensive summary of the article",
        data: {
          content: "This is a comprehensive summary of the article",
          model: "test-model",
          id: "summary-id",
          citations: ["citation1"],
          log_id: "log-123",
          verifiedQuotes: {
            verified: ["summary quote 1"],
            missing: ["summary quote 2"],
          },
        },
      },
    });

    expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
      123,
      "articles",
      "test-item-id",
      "summary",
      {
        originalArticle: "This is a long article that needs to be summarized",
        summary: {
          content: "This is a comprehensive summary of the article",
          model: "test-model",
          id: "summary-id",
          citations: ["citation1"],
          log_id: "log-123",
          verifiedQuotes: {
            verified: ["summary quote 1"],
            missing: ["summary quote 2"],
          },
        },
        title: "Summary: This is a long article that needs to be summarized...",
      },
    );
  });

  it("should handle summary response with only response field", async () => {
    const mockSummaryResponse = {
      response: "Summary using response field",
      id: "summary-id",
    };

    mockProvider.getResponse.mockResolvedValue(mockSummaryResponse);
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "saved-summary-id",
    });

    const result = await summariseArticle(mockParams);

    expect(result.summary?.content).toBe("Summary using response field");
  });

  it("should throw error when summary content is empty", async () => {
    const mockSummaryResponse = {
      content: "",
      response: "",
    };

    mockProvider.getResponse.mockResolvedValue(mockSummaryResponse);

    await expect(summariseArticle(mockParams)).rejects.toThrow(AssistantError);

    await expect(summariseArticle(mockParams)).rejects.toThrow(
      "Summary content was empty",
    );
  });

  it("should properly sanitise input article", async () => {
    mockProvider.getResponse.mockResolvedValue({
      content: "Summary result",
    });
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "saved-summary-id",
    });

    const { sanitiseInput } = await import("~/lib/chat/utils");

    await summariseArticle(mockParams);

    expect(vi.mocked(sanitiseInput)).toHaveBeenCalledWith(
      "This is a long article that needs to be summarized",
    );
  });

  it("should extract and verify quotes from summary", async () => {
    mockProvider.getResponse.mockResolvedValue({
      content: "Summary with quotes",
    });
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "saved-summary-id",
    });

    const { extractQuotes } = await import("~/utils/extract");
    const { verifyQuotes } = await import("~/utils/verify");

    await summariseArticle(mockParams);

    expect(vi.mocked(extractQuotes)).toHaveBeenCalledWith(
      "Summary with quotes",
    );
    expect(vi.mocked(verifyQuotes)).toHaveBeenCalledWith(
      "This is a long article that needs to be summarized",
      ["summary quote 1", "summary quote 2"],
    );
  });

  it("should throw AssistantError when provider throws non-AssistantError", async () => {
    mockProvider.getResponse.mockRejectedValue(new Error("API Error"));

    await expect(summariseArticle(mockParams)).rejects.toThrow(AssistantError);

    await expect(summariseArticle(mockParams)).rejects.toThrow(
      "Failed to summarise article",
    );
  });

  it("should rethrow AssistantError from dependencies", async () => {
    const originalError = new AssistantError(
      "Custom error",
      ErrorType.PARAMS_ERROR,
    );
    mockProvider.getResponse.mockRejectedValue(originalError);

    await expect(summariseArticle(mockParams)).rejects.toThrow(originalError);
  });

  it("should call AI provider with correct prompt", async () => {
    mockProvider.getResponse.mockResolvedValue({
      content: "Summary result",
    });
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "saved-summary-id",
    });

    await summariseArticle(mockParams);

    expect(mockProvider.getResponse).toHaveBeenCalledWith({
      completion_id: "test-completion",
      app_url: "https://example.com",
      model: "test-model",
      messages: [
        {
          role: "user",
          content: expect.any(String),
        },
      ],
      env: mockEnv,
      user: mockUser,
    });
  });

  it("should truncate long article titles appropriately", async () => {
    const longArticle = "A".repeat(100);
    const paramsWithLongArticle = {
      ...mockParams,
      args: { ...mockParams.args, article: longArticle },
    };

    mockProvider.getResponse.mockResolvedValue({
      content: "Summary result",
    });
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "saved-summary-id",
    });

    await summariseArticle(paramsWithLongArticle);

    const savedData = mockAppDataRepo.createAppDataWithItem.mock.calls[0][4];
    expect(savedData.title).toBe(`Summary: ${"A".repeat(80)}...`);
  });
});
