import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/providers/base", () => ({
  BaseProvider: class MockBaseProvider {
    name = "mock";
    supportsStreaming = true;
    validateParams() {}
    async getHeaders() {
      return {};
    }
    async getApiKey(params: any) {
      return params.env.ANTHROPIC_API_KEY || "default-key";
    }
  },
}));

vi.mock("~/lib/models", () => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
  createCommonParameters: vi.fn(),
  shouldEnableStreaming: vi.fn(),
  getToolsForProvider: vi.fn(),
  calculateReasoningBudget: vi.fn(),
}));

describe("AnthropicProvider", () => {
  describe("validateParams", () => {
    it("should validate params correctly", async () => {
      const { AnthropicProvider } = await import("../anthropic");
      const provider = new AnthropicProvider();

      const validParams = {
        model: "claude-3-sonnet",
        messages: [],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      // @ts-ignore - validateParams is protected
      expect(() => provider.validateParams(validParams as any)).not.toThrow();

      const invalidParams = {
        model: "claude-3-sonnet",
        messages: [],
        env: {},
      };

      // @ts-ignore - validateParams is protected
      expect(() => provider.validateParams(invalidParams as any)).toThrow(
        "Missing AI_GATEWAY_TOKEN",
      );
    });
  });

  describe("getHeaders", () => {
    it("should generate correct headers", async () => {
      const { AnthropicProvider } = await import("../anthropic");
      const provider = new AnthropicProvider();

      const params = {
        env: {
          AI_GATEWAY_TOKEN: "test-token",
          ANTHROPIC_API_KEY: "test-key",
        },
        user: { email: "test@example.com" },
      };

      // @ts-ignore - getHeaders is protected
      const headers = await provider.getHeaders(params as any);

      expect(headers).toEqual({
        "cf-aig-authorization": "test-token",
        "x-api-key": "test-key",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "code-execution-2025-05-22",
        "Content-Type": "application/json",
        "cf-aig-metadata": JSON.stringify({ email: "test@example.com" }),
      });
    });
  });

  describe("mapParameters", () => {
    it("should add web search tool in mapParameters when search grounding enabled", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const {
        createCommonParameters,
        shouldEnableStreaming,
        getToolsForProvider,
        calculateReasoningBudget,
      } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "claude-3-sonnet",
        supportsToolCalls: true,
        supportsSearchGrounding: true,
      });

      vi.mocked(createCommonParameters).mockReturnValue({
        model: "claude-3-sonnet",
        temperature: 0.7,
        max_tokens: 1024,
      });

      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });
      vi.mocked(calculateReasoningBudget).mockReturnValue(2000);

      const { AnthropicProvider } = await import("../anthropic");
      const provider = new AnthropicProvider();

      const params = {
        model: "claude-3-sonnet",
        messages: [{ role: "user", content: "Hello" }],
        enabled_tools: ["search_grounding"],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.tools).toContainEqual({
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      });
    });

    it("should handle thinking model parameters in mapParameters", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const {
        createCommonParameters,
        shouldEnableStreaming,
        getToolsForProvider,
        calculateReasoningBudget,
      } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "claude-3-thinking",
        supportsReasoning: true,
      });

      vi.mocked(createCommonParameters).mockReturnValue({
        model: "claude-3-thinking",
        temperature: 0.7,
        max_tokens: 1024,
      });

      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });
      vi.mocked(calculateReasoningBudget).mockReturnValue(2000);

      const { AnthropicProvider } = await import("../anthropic");
      const provider = new AnthropicProvider();

      const params = {
        model: "claude-3-thinking",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.thinking).toEqual({
        type: "enabled",
        budget_tokens: 2000,
      });
      expect(result.temperature).toBe(1);
      expect(result.max_tokens).toBe(1025);
    });
  });
});
