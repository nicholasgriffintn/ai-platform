import { afterEach, describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { BedrockProvider } from "../bedrock";

const ORIGINAL_FETCH = global.fetch;

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
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

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

  describe("formatBedrockMessages", () => {
    it("maps text and tool call content", async () => {
      const provider = new BedrockProvider();
      const params = {
        messages: [
          { role: "user", content: "Hello" },
          {
            role: "assistant",
            content: [{ type: "text", text: "Working on it" }],
            tool_calls: [
              {
                id: "call-1",
                function: {
                  name: "getWeather",
                  arguments: "{\"city\":\"Paris\"}",
                },
              },
            ],
          },
        ],
        env: { EMBEDDINGS_OUTPUT_BUCKET_OWNER: "owner" },
      };

      // @ts-ignore - accessing private method for testing
      const formatted = await provider.formatBedrockMessages(params);

      expect(formatted).toEqual([
        { role: "user", content: [{ text: { text: "Hello" } }] },
        {
          role: "assistant",
          content: [
            { text: { text: "Working on it" } },
            {
              toolUse: {
                input: { city: "Paris" },
                name: "getWeather",
                toolUseId: "call-1",
              },
            },
          ],
        },
      ]);
    });

    it("includes remote media and markdown documents", async () => {
      const binary = Buffer.from("hello world");
      const response = new Response(binary, {
        headers: { "Content-Type": "image/png" },
      });
      global.fetch = vi.fn().mockResolvedValue(response as any);

      const provider = new BedrockProvider();
      const params = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: "https://example.com/image.png" },
              },
              {
                type: "markdown_document",
                markdown_document: { markdown: "# Hello" },
              },
            ],
          },
        ],
        env: { EMBEDDINGS_OUTPUT_BUCKET_OWNER: "owner" },
      };

      // @ts-ignore - accessing private method for testing
      const formatted = await provider.formatBedrockMessages(params);

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/image.png");
      expect(formatted).toHaveLength(1);
      const content = formatted[0]?.content ?? [];
      expect(content[0]).toEqual({
        image: {
          format: "png",
          source: { bytes: binary.toString("base64") },
        },
      });
      expect(content[1]).toEqual({
        document: {
          format: "markdown",
          source: { bytes: Buffer.from("# Hello", "utf-8").toString("base64") },
        },
      });
    });

    it("maps tool results back to the user role", async () => {
      const provider = new BedrockProvider();
      const params = {
        messages: [
          {
            role: "tool",
            tool_call_id: "call-1",
            content: "{\"temperature\":22}",
          },
        ],
        env: { EMBEDDINGS_OUTPUT_BUCKET_OWNER: "owner" },
      };

      // @ts-ignore - accessing private method for testing
      const formatted = await provider.formatBedrockMessages(params);

      expect(formatted).toEqual([
        {
          role: "user",
          content: [
            {
              toolResult: {
                toolUseId: "call-1",
                status: "success",
                content: [{ text: { text: '{"temperature":22}' } }],
              },
            },
          ],
        },
      ]);
    });
  });
});
