import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const { mockUploadImageFromChat, mockUploadAudioFromChat, mockStorageService } =
  vi.hoisted(() => {
    const mockUploadImageFromChat = vi.fn();
    const mockUploadAudioFromChat = vi.fn();
    const mockStorageService = {
      uploadObject: vi.fn().mockResolvedValue("test-key"),
      getObject: vi.fn(),
    };

    return {
      mockUploadImageFromChat,
      mockUploadAudioFromChat,
      mockStorageService,
    };
  });

vi.mock("../storage", () => ({
  StorageService: vi.fn().mockImplementation(() => mockStorageService),
}));

vi.mock("../upload", () => ({
  uploadImageFromChat: mockUploadImageFromChat,
  uploadAudioFromChat: mockUploadAudioFromChat,
}));

global.fetch = vi.fn();

import { ResponseFormatter } from "../responses";

describe("ResponseFormatter", () => {
  const mockEnv: IEnv = {
    ASSETS_BUCKET: "test-bucket",
    PUBLIC_ASSETS_URL: "https://assets.example.com",
  } as IEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatResponse", () => {
    it("should format OpenAI response", async () => {
      const data = {
        choices: [{ message: { content: "OpenAI response" } }],
      };

      const result = await ResponseFormatter.formatResponse(data, "openai");

      expect(result.response).toBe("OpenAI response");
    });

    it("should format Anthropic response", async () => {
      const data = {
        content: [
          { type: "text", text: "Anthropic response" },
          { type: "thinking", thinking: "Internal thought" },
        ],
      };

      const result = await ResponseFormatter.formatResponse(data, "anthropic");

      expect(result.response).toBe("Anthropic response");
      expect(result.thinking).toBe("Internal thought");
    });

    it("should format Google AI Studio response", async () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                { text: "Google response" },
                {
                  functionCall: {
                    name: "test_function",
                    args: { param: "value" },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = await ResponseFormatter.formatResponse(
        data,
        "google-ai-studio",
      );

      expect(result.response).toBe("Google response");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].name).toBe("test_function");
    });

    it("should use OpenAI formatter for providers that share format", async () => {
      const data = {
        choices: [{ message: { content: "Shared format response" } }],
      };

      const providers = [
        "groq",
        "mistral",
        "perplexity-ai",
        "deepseek",
        "huggingface",
        "github-models",
        "together-ai",
      ];

      for (const provider of providers) {
        const result = await ResponseFormatter.formatResponse(data, provider);
        expect(result.response).toBe("Shared format response");
      }
    });

    it("should handle unknown provider with generic formatter", async () => {
      const data = {
        choices: [{ message: { content: "Unknown provider response" } }],
      };

      const result = await ResponseFormatter.formatResponse(
        data,
        "unknown-provider",
      );

      expect(result.response).toBe("Unknown provider response");
    });
  });

  describe("formatOpenAIResponse", () => {
    it("should handle image generation response", async () => {
      const data = {
        data: [
          { url: "https://example.com/image1.png" },
          { url: "https://example.com/image2.png" },
        ],
      };

      const result = await ResponseFormatter.formatResponse(data, "openai", {
        type: ["text-to-image"],
      });

      expect(result.response).toHaveLength(2);
      expect(result.response[0].type).toBe("image_url");
      expect(result.response[0].image_url.url).toBe(
        "https://example.com/image1.png",
      );
      expect(result.response[1].image_url.url).toBe(
        "https://example.com/image2.png",
      );
    });

    it("should handle image generation without env", async () => {
      const data = {
        data: [{ url: "https://example.com/image.png" }],
      };

      const result = await ResponseFormatter.formatResponse(data, "openai", {
        type: ["text-to-image"],
      });

      expect(result.response).toHaveLength(1);
      expect(result.response[0].image_url.url).toBe(
        "https://example.com/image.png",
      );
    });

    it("should handle regular chat response", async () => {
      const data = {
        choices: [
          {
            message: {
              content: "Chat response",
              tool_calls: [{ id: "call_1", function: { name: "test" } }],
            },
          },
        ],
      };

      const result = await ResponseFormatter.formatResponse(data, "openai");

      expect(result.response).toBe("Chat response");
      expect(result.tool_calls).toHaveLength(1);
    });
  });

  describe("formatAnthropicResponse", () => {
    it("should handle response with no content", async () => {
      const data = {};

      const result = await ResponseFormatter.formatResponse(data, "anthropic");

      expect(result.response).toBe("");
    });

    it("should extract text and thinking content", async () => {
      const data = {
        content: [
          { type: "text", text: "First text" },
          { type: "text", text: "Second text" },
          { type: "thinking", thinking: "My thoughts" },
          { type: "other", data: "ignored" },
        ],
      };

      const result = await ResponseFormatter.formatResponse(data, "anthropic");

      expect(result.response).toBe("First text Second text");
      expect(result.thinking).toBe("My thoughts");
    });

    it("should handle signature in thinking content", async () => {
      const data = {
        content: [
          { type: "text", text: "Response text" },
          {
            type: "thinking",
            thinking: "Thoughts",
            signature: "signature_data",
          },
        ],
      };

      const result = await ResponseFormatter.formatResponse(data, "anthropic");

      expect(result.signature).toBe("signature_data");
    });
  });

  describe("formatGoogleStudioResponse", () => {
    it("should handle response with no candidates", async () => {
      const data = {};

      const result = await ResponseFormatter.formatResponse(
        data,
        "google-ai-studio",
      );

      expect(result.response).toBe("");
      expect(result.tool_calls).toEqual([]);
    });

    it("should handle executable code in response", async () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                { text: "Here's the code:" },
                {
                  executableCode: {
                    language: "python",
                    code: "print('hello')",
                  },
                },
              ],
            },
          },
        ],
      };

      const result = await ResponseFormatter.formatResponse(
        data,
        "google-ai-studio",
      );

      expect(result.response).toContain("Here's the code:");
      expect(result.response).toContain(
        '<artifact identifier="executable-code-1"',
      );
      expect(result.response).toContain("print('hello')");
    });

    it("should handle code execution results", async () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                {
                  codeExecutionResult: {
                    outcome: "OK",
                    output: "hello\n",
                  },
                },
              ],
            },
          },
        ],
      };

      const result = await ResponseFormatter.formatResponse(
        data,
        "google-ai-studio",
      );

      expect(result.response).toContain("hello");
    });
  });

  describe("formatOllamaResponse", () => {
    it("should format Ollama response", async () => {
      const data = {
        message: { content: "Ollama response" },
        other: "field",
      };

      const result = await ResponseFormatter.formatResponse(data, "ollama");

      expect(result.response).toBe("Ollama response");
      expect(result.other).toBe("field");
    });
  });

  describe("formatWorkersResponse", () => {
    it("should handle image generation for workers", async () => {
      const data = {
        image: "base64imagedata",
      };

      const result = await ResponseFormatter.formatResponse(
        data,
        "workers-ai",
        {
          type: ["text-to-image"],
        },
      );

      expect(result.response).toBe("base64imagedata");
    });

    it("should handle text generation for workers", async () => {
      const data = {
        result: "Workers text response",
      };

      const result = await ResponseFormatter.formatResponse(data, "workers");

      expect(result.response).toBe("Workers text response");
    });

    it("should handle audio generation for workers", async () => {
      const data = {
        result: [1, 2, 3, 4, 5],
      };

      const result = await ResponseFormatter.formatResponse(
        data,
        "workers-ai",
        {
          type: ["text-to-speech"],
          env: mockEnv,
          completion_id: "test-completion",
        },
      );

      expect(result.response).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("formatBedrockResponse", () => {
    it("should handle Bedrock image generation", async () => {
      const data = {
        images: ["base64imagedata"],
      };

      const result = await ResponseFormatter.formatResponse(data, "bedrock", {
        type: ["text-to-image"],
      });

      expect(result.response).toBe("base64imagedata");
    });

    it("should handle Bedrock text generation", async () => {
      const data = {
        output: {
          message: {
            content: [{ text: "Bedrock response" }],
          },
        },
      };

      const result = await ResponseFormatter.formatResponse(data, "bedrock");

      expect(result.response).toBe("Bedrock response");
    });
  });

  describe("formatGenericResponse", () => {
    it("should handle response field", async () => {
      const data = { response: "Generic response" };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("Generic response");
    });

    it("should extract from choices array", async () => {
      const data = {
        choices: [{ message: { content: "Choice content" } }],
      };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("Choice content");
    });

    it("should handle delta content", async () => {
      const data = {
        choices: [{ delta: { content: "Delta content" } }],
      };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("Delta content");
    });

    it("should handle text field in choices", async () => {
      const data = {
        choices: [{ text: "Choice text" }],
      };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("Choice text");
    });

    it("should handle direct content array", async () => {
      const data = {
        content: [
          { type: "text", text: "Array text" },
          { type: "thinking", thinking: "Array thinking" },
        ],
      };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("Array text");
      expect(result.thinking).toBe("Array thinking");
    });

    it("should handle message content array", async () => {
      const data = {
        message: {
          content: [
            { type: "text", text: "Message text" },
            {
              type: "thinking",
              thinking: "Message thinking",
              signature: "sig",
            },
          ],
        },
      };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("Message text");
      expect(result.thinking).toBe("Message thinking");
      expect(result.signature).toBe("sig");
    });

    it("should return empty response for unrecognized format", async () => {
      const data = { unknown: "field" };

      const result = await ResponseFormatter.formatResponse(data, "unknown");

      expect(result.response).toBe("");
    });
  });

  describe("error handling", () => {
    it("should handle missing ASSETS_BUCKET for image upload", async () => {
      const data = {
        data: [{ url: "https://example.com/image.png" }],
      };

      const envWithoutBucket = { ...mockEnv, ASSETS_BUCKET: undefined };

      await expect(
        ResponseFormatter.formatResponse(data, "openai", {
          type: ["text-to-image"],
          env: envWithoutBucket,
        }),
      ).rejects.toThrow("ASSETS_BUCKET is not set");
    });

    it("should handle fetch failure during image upload", async () => {
      const data = {
        data: [{ url: "https://example.com/image.png" }],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValue(new Error("Fetch failed"));

      await expect(
        ResponseFormatter.formatResponse(data, "openai", {
          type: ["text-to-image"],
          env: mockEnv,
        }),
      ).rejects.toThrow("Fetch failed");
    });

    it("should handle missing ASSETS_BUCKET for image upload", async () => {
      const data = {
        data: [{ url: "https://example.com/image.png" }],
      };

      const envWithoutBucket = { ...mockEnv, ASSETS_BUCKET: undefined };

      await expect(
        ResponseFormatter.formatResponse(data, "openai", {
          type: ["text-to-image"],
          env: envWithoutBucket,
        }),
      ).rejects.toThrow("ASSETS_BUCKET is not set");
    });
  });
});
