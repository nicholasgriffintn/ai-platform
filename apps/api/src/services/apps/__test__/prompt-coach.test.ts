import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { handlePromptCoachSuggestion } from "../prompt-coach";

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/lib/chat/responses", () => ({
  getAIResponse: vi.fn(),
}));

vi.mock("~/lib/prompts/coaching", () => ({
  returnCoachingPrompt: vi.fn(() => "Coaching system prompt"),
}));

describe("prompt-coach service", () => {
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

  describe("handlePromptCoachSuggestion", () => {
    it("should return prompt coaching response", async () => {
      const mockAIResponse = {
        response: `
          <prompt_analysis>This prompt could be improved by being more specific.</prompt_analysis>
          <revised_prompt>Write a detailed 500-word article about machine learning applications in healthcare, focusing on diagnostic imaging and patient outcomes.</revised_prompt>
          <suggestions>1. Be more specific about the topic. 2. Include word count requirements. 3. Focus on specific applications.</suggestions>
          <format_optimization>Consider using structured prompts with clear sections.</format_optimization>
          <prompt_type>technical</prompt_type>
        `,
      };

      const { getAIResponse } = await import("~/lib/chat/responses");
      vi.mocked(getAIResponse).mockResolvedValue(mockAIResponse);

      const result = await handlePromptCoachSuggestion({
        env: mockEnv,
        user: mockUser,
        prompt: "Write about machine learning",
      });

      expect(result).toEqual({
        suggested_prompt:
          "Write a detailed 500-word article about machine learning applications in healthcare, focusing on diagnostic imaging and patient outcomes.",
        full_response: mockAIResponse.response,
        analysis: "This prompt could be improved by being more specific.",
        suggestions: [
          "Be more specific about the topic.",
          "Include word count requirements.",
          "Focus on specific applications.",
        ],
        format_optimization:
          "Consider using structured prompts with clear sections.",
        confidence_score: expect.any(Number),
        prompt_type: "technical",
      });
    });

    it("should handle AI response without suggested prompt", async () => {
      const mockAIResponse = {
        response: `
          <prompt_analysis>This prompt is already well-structured.</prompt_analysis>
          <suggestions>1. No major improvements needed.</suggestions>
        `,
      };

      const { getAIResponse } = await import("~/lib/chat/responses");
      vi.mocked(getAIResponse).mockResolvedValue(mockAIResponse);

      const result = await handlePromptCoachSuggestion({
        env: mockEnv,
        user: mockUser,
        prompt: "Explain quantum computing in simple terms",
      });

      expect(result.suggested_prompt).toBeNull();
      expect(result.analysis).toBe("This prompt is already well-structured.");
    });

    it("should handle recursive improvement", async () => {
      const mockAIResponse = {
        response: `
          <revised_prompt>Improved prompt version</revised_prompt>
          <prompt_analysis>This prompt has been improved.</prompt_analysis>
          <prompt_type>creative</prompt_type>
        `,
      };

      const { getAIResponse } = await import("~/lib/chat/responses");
      vi.mocked(getAIResponse).mockResolvedValue(mockAIResponse);

      const _result = await handlePromptCoachSuggestion({
        env: mockEnv,
        user: mockUser,
        prompt: "Write something",
        recursionDepth: 1,
      });

      expect(vi.mocked(getAIResponse)).toHaveBeenCalledTimes(2);
    });

    it("should calculate confidence score correctly", async () => {
      const mockAIResponse = {
        response: `
          <prompt_analysis>Detailed analysis here with lots of content to make it longer than 1000 characters. This analysis goes into great detail about the various aspects of the prompt that could be improved, including specificity, clarity, structure, and desired outcomes. The prompt lacks clear instructions and could benefit from more specific guidance about the expected format and length of the response. Additionally, it would be helpful to include context about the intended audience and the purpose of the content being generated.</prompt_analysis>
          <revised_prompt>Much better version</revised_prompt>
          <suggestions>1. Add specificity. 2. Include context. 3. Define format.</suggestions>
          <format_optimization>Use structured approach</format_optimization>
        `,
      };

      const { getAIResponse } = await import("~/lib/chat/responses");
      vi.mocked(getAIResponse).mockResolvedValue(mockAIResponse);

      const result = await handlePromptCoachSuggestion({
        env: mockEnv,
        user: mockUser,
        prompt: "Write something",
      });

      expect(result.confidence_score).toBeGreaterThan(0.8);
    });

    it("should throw error when AI response is empty", async () => {
      const { getAIResponse } = await import("~/lib/chat/responses");
      vi.mocked(getAIResponse).mockResolvedValue({ response: "" });

      await expect(
        handlePromptCoachSuggestion({
          env: mockEnv,
          user: mockUser,
          prompt: "Test prompt",
        }),
      ).rejects.toThrow(AssistantError);
    });

    it("should handle different prompt types", async () => {
      const mockAIResponse = {
        response: `
          <revised_prompt>Creative writing prompt</revised_prompt>
          <prompt_type>creative</prompt_type>
        `,
      };

      const { getAIResponse } = await import("~/lib/chat/responses");
      vi.mocked(getAIResponse).mockResolvedValue(mockAIResponse);

      const result = await handlePromptCoachSuggestion({
        env: mockEnv,
        user: mockUser,
        prompt: "Write a story",
        promptType: "creative",
      });

      expect(result.prompt_type).toBe("creative");
    });
  });
});
