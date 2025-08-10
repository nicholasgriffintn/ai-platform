import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { BedrockProvider } from "../bedrock";

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
}));

describe("BedrockProvider", () => {
  describe("mapParameters", () => {
    it("should handle video generation in mapParameters", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "bedrock-video",
        type: ["text-to-video"],
      });

      const provider = new BedrockProvider();

      const params = {
        model: "bedrock-video",
        messages: [{ role: "user", content: "Create a video of a sunset" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.taskType).toBe("TEXT_VIDEO");
      expect(result.textToVideoParams.text).toBe("Create a video of a sunset");
      expect(result.videoGenerationConfig).toEqual({
        durationSeconds: 6,
        fps: 24,
        dimension: "1280x720",
      });
    });

    it("should handle image generation in mapParameters", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "bedrock-image",
        type: ["text-to-image"],
      });

      const provider = new BedrockProvider();

      const params = {
        model: "bedrock-image",
        messages: [{ role: "user", content: "Draw a cat" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      const result = await provider.mapParameters(params as any);

      expect(result.taskType).toBe("TEXT_IMAGE");
      expect(result.textToImageParams.text).toBe("Draw a cat");
      expect(result.imageGenerationConfig).toEqual({
        quality: "standard",
        width: 1280,
        height: 1280,
        numberOfImages: 1,
      });
    });
  });

  describe("parseAwsCredentials", () => {
    it("should parse AWS credentials correctly", async () => {
      const provider = new BedrockProvider();

      // Test valid credentials format
      const validCredentials = "AKIATEST123::@@::secretkey456";
      // @ts-ignore - accessing private method for testing
      const parsed = provider.parseAwsCredentials(validCredentials);

      expect(parsed.accessKey).toBe("AKIATEST123");
      expect(parsed.secretKey).toBe("secretkey456");

      const invalidCredentials = "invalid-format";
      expect(() => {
        // @ts-ignore - accessing private method for testing
        provider.parseAwsCredentials(invalidCredentials);
      }).toThrow("Invalid AWS credentials format");
    });
  });
});
