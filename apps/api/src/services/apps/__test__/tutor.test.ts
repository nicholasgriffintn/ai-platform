import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { completeTutorRequest } from "../tutor";

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/services/search/web", () => ({
  handleWebSearch: vi.fn(),
}));

vi.mock("~/lib/models", () => ({
  getAuxiliaryModel: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(),
  },
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "test-completion-id"),
}));

describe("tutor service", () => {
  const mockEnv = {} as any;
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("completeTutorRequest", () => {
    it("should complete tutor request successfully", async () => {
      const mockWebSearchResults = {
        data: {
          provider: "tavily",
          result: {
            results: [
              {
                title: "Test Result",
                url: "https://example.com",
                content: "Test content",
                score: 0.9,
              },
            ],
          },
          results: [
            {
              title: "Test Result",
              url: "https://example.com",
              content: "Test content",
              score: 0.9,
            },
          ],
          warning: undefined,
        },
      };

      const mockProvider = {
        name: "test-provider",
        supportsStreaming: false,
        getResponse: vi.fn().mockResolvedValue({
          response: "This is a comprehensive explanation...",
        }),
        createRealtimeSession: vi.fn(),
      };

      const { handleWebSearch } = await import("~/services/search/web");
      const { getAuxiliaryModel } = await import("~/lib/models");
      const { AIProviderFactory } = await import("~/lib/providers/factory");

      vi.mocked(handleWebSearch).mockResolvedValue(mockWebSearchResults);
      vi.mocked(getAuxiliaryModel).mockResolvedValue({
        model: "test-model",
        provider: "test-provider",
      });
      vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

      const result = await completeTutorRequest(mockEnv, mockUser, {
        topic: "machine learning",
        level: "intermediate",
        options: {
          search_depth: "basic",
          include_answer: true,
          include_raw_content: false,
          include_images: false,
          max_results: 5,
        },
      });

      expect(result).toEqual({
        answer: "This is a comprehensive explanation...",
        sources: [
          {
            title: "Test Result",
            url: "https://example.com",
            content: "Test content",
            excerpts: [],
            score: 0.9,
          },
        ],
        provider: "tavily",
        providerWarning: undefined,
        completion_id: "test-completion-id-tutor",
      });
    });

    it("should throw error if topic is missing", async () => {
      await expect(
        completeTutorRequest(mockEnv, mockUser, {
          topic: "",
          level: "beginner",
          options: {
            search_depth: "basic",
            include_answer: true,
            include_raw_content: false,
            include_images: false,
            max_results: 5,
          },
        }),
      ).rejects.toThrow(expect.any(AssistantError));
    });

    it("should throw error if options are missing", async () => {
      await expect(
        completeTutorRequest(mockEnv, mockUser, {
          topic: "machine learning",
          level: "beginner",
        } as any),
      ).rejects.toThrow(expect.any(AssistantError));
    });

    it("should handle different difficulty levels", async () => {
      const mockWebSearchResults = {
        data: {
          provider: "tavily",
          result: {
            results: [
              {
                title: "Advanced ML",
                url: "https://example.com",
                content: "Advanced content",
                score: 0.8,
              },
            ],
          },
          results: [
            {
              title: "Advanced ML",
              url: "https://example.com",
              content: "Advanced content",
              score: 0.8,
            },
          ],
          warning: undefined,
        },
      };

      const mockProvider = {
        name: "test-provider",
        supportsStreaming: false,
        getResponse: vi.fn().mockResolvedValue({
          response: "Advanced explanation...",
        }),
        createRealtimeSession: vi.fn(),
      };

      const { handleWebSearch } = await import("~/services/search/web");
      const { getAuxiliaryModel } = await import("~/lib/models");
      const { AIProviderFactory } = await import("~/lib/providers/factory");

      vi.mocked(handleWebSearch).mockResolvedValue(mockWebSearchResults);
      vi.mocked(getAuxiliaryModel).mockResolvedValue({
        model: "test-model",
        provider: "test-provider",
      });
      vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

      const result = await completeTutorRequest(mockEnv, mockUser, {
        topic: "neural networks",
        level: "advanced",
        options: {
          search_depth: "advanced",
          include_answer: true,
          include_raw_content: true,
          include_images: false,
          max_results: 10,
        },
      });

      expect(result.answer).toBe("Advanced explanation...");
      expect(handleWebSearch).toHaveBeenCalledWith({
        query: "I want to learn about neural networks",
        options: {
          search_depth: "advanced",
          include_answer: true,
          include_raw_content: true,
          include_images: false,
          max_results: 9,
        },
        env: mockEnv,
        user: mockUser,
      });
    });
  });
});
