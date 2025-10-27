import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { ReplicateProvider, buildReplicateInput } from "../replicate";

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

vi.mock("~/lib/providers/factory", () => ({}));

global.fetch = vi.fn();

describe("ReplicateProvider", () => {
  describe("mapParameters", () => {
    it("should construct input payload using schema defaults and prompt", async () => {
      // @ts-ignore - mocked implementation
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel: "replicate-model",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "num_outputs", type: "integer", default: 1 },
          ],
        },
      });

      const provider = new ReplicateProvider();

      const params = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        completion_id: "test-completion-id",
      };

      const result = await provider.mapParameters(params as any);

      expect(result).toEqual({
        model: "replicate-model",
        version: "replicate-model",
        input: {
          prompt: "Hello",
          num_outputs: 1,
        },
      });
    });

    it("should include enumerated options from params", async () => {
      // @ts-ignore - mocked implementation
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel: "replicate-model",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            {
              name: "model_version",
              type: "string",
              enum: ["melody", "medium"],
              default: "melody",
            },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Compose" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        model_version: "medium",
      };

      const result = await provider.mapParameters(params as any);

      expect(result).toEqual({
        model: "replicate-model",
        version: "replicate-model",
        input: {
          prompt: "Compose",
          model_version: "medium",
        },
      });
    });
  });

  describe("buildReplicateInput", () => {
    it("should throw when enum value is invalid", () => {
      const params: any = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Prompt" }],
        env: { AI_GATEWAY_TOKEN: "token" },
        model_version: "invalid",
      };

      const config: any = {
        matchingModel: "replicate-model",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "model_version", type: "string", enum: ["melody"] },
          ],
        },
      };

      expect(() => buildReplicateInput(params, config)).toThrow(
        'Invalid value "invalid" for field "model_version"',
      );
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
