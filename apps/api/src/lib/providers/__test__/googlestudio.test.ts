import { describe, expect, it, vi } from "vitest";

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
  getEffectiveMaxTokens: vi.fn(),
}));

describe("GoogleStudioProvider", () => {
  describe("validateParams", () => {
    it("should validate params correctly", async () => {
      const { GoogleStudioProvider } = await import("../googlestudio");
      const provider = new GoogleStudioProvider();

      const validParams = {
        model: "gemini-pro",
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

  describe("getEndpoint", () => {
    it("should return the correct non streaming endpoint", async () => {
      const { GoogleStudioProvider } = await import("../googlestudio");
      const provider = new GoogleStudioProvider();

      const params = {
        model: "gemini-pro",
        messages: [{ role: "user", content: "Search for something" }],
        enabled_tools: ["web_search", "search_grounding"],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      // @ts-ignore - getEndpoint is protected
      const endpoint = provider.getEndpoint(params as any);

      expect(endpoint).toBe("v1beta/models/gemini-pro:generateContent");
    });

    it("should return the correct streaming endpoint", async () => {
      const { GoogleStudioProvider } = await import("../googlestudio");
      const provider = new GoogleStudioProvider();

      const params = {
        model: "gemini-pro",
        messages: [{ role: "user", content: "Search for something" }],
        enabled_tools: ["web_search", "search_grounding"],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        stream: true,
      };

      // @ts-ignore - getEndpoint is protected
      const endpoint = provider.getEndpoint(params as any);

      expect(endpoint).toBe(
        "v1beta/models/gemini-pro:streamGenerateContent?alt=sse",
      );
    });
  });

  describe("mapParameters", () => {
    it("should add code execution tool in mapParameters", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const { getEffectiveMaxTokens } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "gemini-pro",
        supportsFunctions: true,
        supportsCodeExecution: true,
      });

      vi.mocked(getEffectiveMaxTokens).mockReturnValue(1024);

      const { GoogleStudioProvider } = await import("../googlestudio");
      const provider = new GoogleStudioProvider();

      const params = {
        model: "gemini-pro",
        messages: [{ role: "user", content: "Calculate 2+2" }],
        enabled_tools: ["code_execution"],
        system_prompt: "You are a math assistant",
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.tools).toContainEqual({
        code_execution: {},
      });
      expect(result.systemInstruction).toEqual({
        role: "system",
        parts: [{ text: "You are a math assistant" }],
      });
    });

    it("should filter web_search tool when search grounding is supported", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const { getEffectiveMaxTokens } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "gemini-pro",
        supportsFunctions: true,
        supportsSearchGrounding: true,
      });

      vi.mocked(getEffectiveMaxTokens).mockReturnValue(1024);

      const { GoogleStudioProvider } = await import("../googlestudio");
      const provider = new GoogleStudioProvider();

      const params = {
        model: "gemini-pro",
        messages: [{ role: "user", content: "Search for something" }],
        enabled_tools: ["web_search", "search_grounding"],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      // Should only have google_search, not web_search
      expect(result.tools).toContainEqual({
        google_search: {},
      });
      expect(result.tools).toHaveLength(1);
    });
  });
});
