import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { OpenAIProvider } from "../openai";

vi.mock("~/lib/providers/base", () => ({
  BaseProvider: class MockBaseProvider {
    name = "mock";
    supportsStreaming = true;
    validateParams() {}
    async getApiKey() {
      return "test-key";
    }
  },
}));

vi.mock("~/lib/models", () => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
  createCommonParameters: vi.fn(),
  getToolsForProvider: vi.fn(),
  shouldEnableStreaming: vi.fn(),
}));

describe("OpenAIProvider", () => {
  describe("mapParameters", () => {
    it("should handle text-to-image generation in mapParameters", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "dall-e-3",
        type: ["text-to-image"],
      });

      vi.mocked(createCommonParameters).mockReturnValue({});
      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

      const provider = new OpenAIProvider();

      const params = {
        model: "dall-e-3",
        messages: [
          { role: "system", content: "You create images" },
          { role: "user", content: "Draw a sunset over mountains" },
        ],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.prompt).toBe("Draw a sunset over mountains");
    });

    it("should handle image-to-image generation in mapParameters", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "dall-e-edit",
        type: ["image-to-image"],
      });

      vi.mocked(createCommonParameters).mockReturnValue({});
      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

      const provider = new OpenAIProvider();

      const params = {
        model: "dall-e-edit",
        messages: [
          { role: "system", content: "You edit images" },
          {
            role: "user",
            content: [
              { type: "text", text: "Make this image brighter" },
              {
                type: "image_url",
                image_url: { url: "data:image/jpeg;base64,..." },
              },
            ],
          },
        ],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.prompt).toBe("Make this image brighter");
      expect(result.image).toEqual(["data:image/jpeg;base64,..."]);
    });

    it("should handle search preview model parameters in mapParameters", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "gpt-4o-search-preview",
        type: ["text"],
      });

      vi.mocked(createCommonParameters).mockReturnValue({
        model: "gpt-4o-search-preview",
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      });

      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

      const provider = new OpenAIProvider();

      const params = {
        model: "gpt-4o-search-preview",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.frequency_penalty).toBeUndefined();
      expect(result.presence_penalty).toBeUndefined();
      expect(result.temperature).toBeUndefined();
      expect(result.top_p).toBeUndefined();
    });

    it("should add web search tool when search grounding enabled", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "gpt-4",
        type: ["text"],
        supportsToolCalls: true,
        supportsSearchGrounding: true,
      });

      vi.mocked(createCommonParameters).mockReturnValue({
        model: "gpt-4",
        temperature: 0.7,
      });

      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

      const provider = new OpenAIProvider();

      const params = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Search for something" }],
        enabled_tools: ["search_grounding"],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.tools).toContainEqual({ type: "web_search_preview" });
    });

    it("should handle thinking model parameters in mapParameters", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "gpt-4-thinking",
        type: ["text"],
        supportsReasoning: true,
      });

      vi.mocked(createCommonParameters).mockReturnValue({
        model: "gpt-4-thinking",
        temperature: 0.7,
      });

      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

      const provider = new OpenAIProvider();

      const params = {
        model: "gpt-4-thinking",
        messages: [{ role: "user", content: "Think about this problem" }],
        reasoning_effort: "high",
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.reasoning_effort).toBe("high");
    });
  });

  describe("validateParams", () => {
    it("should validate params correctly", async () => {
      const provider = new OpenAIProvider();

      const validParams = {
        model: "gpt-4",
        messages: [],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      // @ts-ignore - validateParams is protected
      expect(() => provider.validateParams(validParams as any)).not.toThrow();

      const invalidParams = {
        messages: [],
        env: {},
      };

      // @ts-ignore - validateParams is protected
      expect(() => provider.validateParams(invalidParams as any)).toThrow(
        "Missing AI_GATEWAY_TOKEN",
      );
    });
  });
});
