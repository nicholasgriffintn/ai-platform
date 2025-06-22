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
  createCommonParameters: vi.fn(),
  getToolsForProvider: vi.fn(),
  shouldEnableStreaming: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({}));

global.fetch = vi.fn();

describe("ReplicateProvider", () => {
  describe("mapParameters", () => {
    it("should create basic parameters in mapParameters", async () => {
      const { getModelConfigByMatchingModel } = await import("~/lib/models");
      const {
        createCommonParameters,
        getToolsForProvider,
        shouldEnableStreaming,
      } = await import("~/utils/parameters");

      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "replicate-model",
        type: ["text"],
      });

      vi.mocked(createCommonParameters).mockReturnValue({
        model: "replicate-model",
        temperature: 0.7,
        max_tokens: 1024,
      });

      vi.mocked(shouldEnableStreaming).mockReturnValue(false);
      vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

      const { ReplicateProvider } = await import("../replicate");
      const provider = new ReplicateProvider();

      const params = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token", WEBHOOK_SECRET: "secret" },
        completion_id: "test-completion-id",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.model).toBe("replicate-model");
      expect(result.temperature).toBe(0.7);
      expect(result.max_tokens).toBe(1024);
    });
  });

  describe("validateParams", () => {
    it("should validate required parameters", async () => {
      const { ReplicateProvider } = await import("../replicate");
      const provider = new ReplicateProvider();

      // Test missing completion_id
      const paramsWithoutCompletionId = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token", WEBHOOK_SECRET: "secret" },
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsWithoutCompletionId as any);
      }).toThrow("Missing completion_id");

      // Test missing message content
      const paramsWithoutContent = {
        model: "replicate-model",
        messages: [{ role: "user", content: "" }],
        env: { AI_GATEWAY_TOKEN: "test-token", WEBHOOK_SECRET: "secret" },
        completion_id: "test-id",
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsWithoutContent as any);
      }).toThrow("Missing last message content");
    });
  });
});
