import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { ReplicateProvider } from "../replicate";

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

      const provider = new ReplicateProvider();

      const params = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
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
      const provider = new ReplicateProvider();

      const paramsMissingKey = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: {},
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsMissingKey as any);
      }).toThrow("Missing AI_GATEWAY_TOKEN");

      const paramsWithoutContent = {
        model: "replicate-model",
        messages: [{ role: "user", content: "" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsWithoutContent as any);
      }).toThrow("Missing last message content");
    });
  });
});
