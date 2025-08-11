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
  createCommonParameters: vi.fn().mockReturnValue({ temperature: 0.2, max_tokens: 1000, top_p: 1 }),
  getToolsForProvider: vi.fn().mockReturnValue({ tools: [] }),
}));

vi.mock("~/lib/utils/imageProcessor", () => ({
  fetchImageAsBase64: vi.fn(async () => "BASE64DATA"),
  getImageFormat: vi.fn(() => "png"),
  validateImageFormat: vi.fn(() => true),
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

    it("should include image parts for image_url content blocks on supported models", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "nova-pro",
        type: ["text", "image-to-text"],
        multimodal: true,
        supportsAttachments: true,
      });

      const provider = new BedrockProvider();

      const params = {
        model: "amazon.nova-pro-v1:0",
        env: { AI_GATEWAY_TOKEN: "test-token" },
        messages: [
          { role: "user", content: [
            { type: "text", text: "What is in this image?" },
            { type: "image_url", image_url: { url: "https://example.com/cat.png" } },
          ] },
        ],
      } as any;

      const mapped = await provider.mapParameters(params);
      expect(mapped.messages[0].content.some((p: any) => p.image)).toBe(true);
    });

    it("should throw when image blocks are used with non-multimodal models", async () => {
      // @ts-ignore - getModelConfigByMatchingModel is not typed
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        name: "text-only",
        type: ["text"],
        multimodal: false,
      });

      const provider = new BedrockProvider();
      const params = {
        model: "text-only",
        env: { AI_GATEWAY_TOKEN: "test-token" },
        messages: [
          { role: "user", content: [
            { type: "text", text: "Describe" },
            { type: "image_url", image_url: { url: "https://example.com/cat.png" } },
          ] },
        ],
      } as any;

      await expect(provider.mapParameters(params)).rejects.toThrow(
        /does not support image inputs/,
      );
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
