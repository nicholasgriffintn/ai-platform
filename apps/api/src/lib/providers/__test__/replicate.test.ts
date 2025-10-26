import { describe, expect, it, vi, beforeEach } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { ReplicateProvider } from "../replicate";
import { ChatCompletionParameters } from "../../../types";

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

      // Test missing completion_id
      const paramsWithoutCompletionId = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsWithoutCompletionId as any);
      }).toThrow("Missing completion_id");

      // Test missing message content
      const paramsWithoutContent = {
        model: "replicate-model",
        messages: [{ role: "user", content: "" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        completion_id: "test-id",
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsWithoutContent as any);
      }).toThrow("Missing last message content");
    });
  });

  describe("pollAsyncStatus", () => {
    beforeEach(() => {
      vi.mocked(fetch).mockClear();
    });

    it("should return completed status when prediction succeeds", async () => {
      const provider = new ReplicateProvider();
      const params = {
        model: "replicate-model",
        env: {
          AI_GATEWAY_TOKEN: "test-token",
          REPLICATE_API_TOKEN: "test-replicate-key",
        },
      } as unknown as ChatCompletionParameters;

      const predictionId = "test-prediction-id";

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "succeeded",
          output: "Generated image URL",
        }),
      } as Response);

      const result = await provider.pollAsyncStatus(predictionId, params);

      expect(result.status).toBe("completed");
      expect(result.result).toBe("Generated image URL");
      expect(result.metadata.status).toBe("completed");
      expect(fetch).toHaveBeenCalledWith(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Token test-replicate-key",
          }),
        }),
      );
    });

    it("should return failed status when prediction fails", async () => {
      const provider = new ReplicateProvider();
      const params = {
        model: "replicate-model",
        env: {
          AI_GATEWAY_TOKEN: "test-token",
          REPLICATE_API_TOKEN: "test-replicate-key",
        },
      } as unknown as ChatCompletionParameters;

      const predictionId = "test-prediction-id";

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "failed",
          error: "Model execution failed",
        }),
      } as Response);

      const result = await provider.pollAsyncStatus(predictionId, params);

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Model execution failed");
      expect(result.metadata.status).toBe("failed");
    });

    it("should return in_progress status when prediction is still running", async () => {
      const provider = new ReplicateProvider();
      const params = {
        model: "replicate-model",
        env: {
          AI_GATEWAY_TOKEN: "test-token",
          REPLICATE_API_TOKEN: "test-replicate-key",
        },
      } as unknown as ChatCompletionParameters;

      const predictionId = "test-prediction-id";

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "processing",
        }),
      } as Response);

      const result = await provider.pollAsyncStatus(predictionId, params);

      expect(result.status).toBe("in_progress");
      expect(result.metadata.status).toBe("in_progress");
    });

    it("should throw error when API call fails", async () => {
      const provider = new ReplicateProvider();
      const params = {
        model: "replicate-model",
        env: {
          AI_GATEWAY_TOKEN: "test-token",
          REPLICATE_API_TOKEN: "test-replicate-key",
        },
      } as unknown as ChatCompletionParameters;

      const predictionId = "test-prediction-id";

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
        status: 500,
      } as Response);

      await expect(
        provider.pollAsyncStatus(predictionId, params),
      ).rejects.toThrow(
        "Failed to poll Replicate prediction: Internal Server Error",
      );
    });
  });
});
