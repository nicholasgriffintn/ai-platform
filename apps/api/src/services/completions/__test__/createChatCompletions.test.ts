import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleCreateChatCompletions } from "../createChatCompletions";

vi.mock("~/lib/chat/core", () => ({
  processChatRequest: vi.fn(),
}));

vi.mock("~/lib/chat/responses", () => ({
  formatAssistantMessage: vi.fn(),
}));

const mockEnv = {
  AI: {
    aiGatewayLogId: "test-log-id",
  },
  DB: "test-db",
} as any;

const mockUser = {
  id: "user-123",
  email: "test@example.com",
} as any;

const mockAnonymousUser = {
  id: "anon-123",
} as any;

describe("handleCreateChatCompletions", () => {
  let mockProcessChatRequest: any;
  let mockFormatAssistantMessage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { processChatRequest } = await import("~/lib/chat/core");
    const { formatAssistantMessage } = await import("~/lib/chat/responses");
    mockProcessChatRequest = vi.mocked(processChatRequest);
    mockFormatAssistantMessage = vi.mocked(formatAssistantMessage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parameter validation", () => {
    it("should throw error for missing messages", async () => {
      const request = {} as any;

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Missing required parameter: messages");
    });

    it("should throw error for empty messages array", async () => {
      const request = { messages: [] } as any;

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Missing required parameter: messages");
    });
  });

  describe("successful chat completion", () => {
    it("should create chat completion with user context", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4",
        temperature: 0.7,
      } as any;

      const mockResponse = {
        response: {
          response: "Hello! How can I help you?",
          usage: { total_tokens: 50 },
        },
        selectedModel: "gpt-4",
      };

      const mockFormattedMessage = {
        content: "Hello! How can I help you?",
        model: "gpt-4",
        usage: { total_tokens: 50 },
        finish_reason: "stop",
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);
      mockFormatAssistantMessage.mockReturnValue(mockFormattedMessage);

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          env: mockEnv,
          user: mockUser,
          messages: request.messages,
          model: request.model,
          temperature: request.temperature,
          completion_id: expect.stringContaining("chat_"),
        }),
      );

      expect(result).toEqual({
        id: "test-log-id",
        log_id: "test-log-id",
        object: "chat.completion",
        created: expect.any(Number),
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello! How can I help you?",
              data: undefined,
              tool_calls: undefined,
              citations: undefined,
            },
            finish_reason: "stop",
          },
        ],
        usage: { total_tokens: 50 },
        post_processing: {
          guardrails: undefined,
        },
      });
    });

    it("should handle anonymous user context", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4",
      } as any;

      const mockResponse = {
        response: {
          response: "Hello!",
          usage: { total_tokens: 30 },
        },
        selectedModel: "gpt-4",
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);
      mockFormatAssistantMessage.mockReturnValue({
        content: "Hello!",
        model: "gpt-4",
        usage: { total_tokens: 30 },
        finish_reason: "stop",
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        anonymousUser: mockAnonymousUser,
      });

      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          anonymousUser: mockAnonymousUser,
          user: undefined,
        }),
      );

      expect(result).toBeDefined();
    });

    it("should handle tool calls in response", async () => {
      const request = {
        messages: [{ role: "user", content: "What's the weather?" }],
        tools: [{ type: "function", function: { name: "get_weather" } }],
      } as any;

      const mockResponse = {
        response: {
          response: "I'll check the weather for you.",
          tool_calls: [
            {
              id: "call_123",
              type: "function",
              function: { name: "get_weather", arguments: "{}" },
            },
          ],
          usage: { total_tokens: 75 },
        },
        selectedModel: "gpt-4",
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);
      mockFormatAssistantMessage.mockReturnValue({
        content: "I'll check the weather for you.",
        model: "gpt-4",
        tool_calls: mockResponse.response.tool_calls,
        usage: { total_tokens: 75 },
        finish_reason: "tool_calls",
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.choices[0].finish_reason).toBe("tool_calls");
      // @ts-expect-error - mock result
      expect(result.choices[0].message.tool_calls).toEqual(
        mockResponse.response.tool_calls,
      );
    });

    it("should generate completion_id when not provided", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        response: {
          response: "Hello!",
          usage: { total_tokens: 20 },
        },
        selectedModel: "gpt-4",
      });

      mockFormatAssistantMessage.mockReturnValue({
        content: "Hello!",
        model: "gpt-4",
        usage: { total_tokens: 20 },
        finish_reason: "stop",
      });

      await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          completion_id: expect.stringMatching(/^chat_\d+$/),
        }),
      );
    });
  });

  describe("streaming responses", () => {
    it("should return streaming response for stream requests", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      } as any;

      const mockStream = new ReadableStream();
      mockProcessChatRequest.mockResolvedValue({
        stream: mockStream,
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("Content-Type")).toBe(
        "text/event-stream",
      );
    });
  });

  describe("guardrails handling", () => {
    it("should handle validation failure", async () => {
      const request = {
        messages: [{ role: "user", content: "Inappropriate content" }],
      } as any;

      const mockValidationResult = {
        validation: true,
        error: "Content violates policy",
        selectedModel: "gpt-4",
      };

      mockProcessChatRequest.mockResolvedValue(mockValidationResult);
      mockFormatAssistantMessage.mockReturnValue({
        content: "Content violates policy",
        model: "gpt-4",
        guardrails: {
          passed: false,
          error: "Content violates policy",
        },
        finish_reason: "content_filter",
        usage: { total_tokens: 0 },
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.choices[0].finish_reason).toBe("content_filter");
      // @ts-expect-error - mock result
      expect(result.post_processing.guardrails.passed).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw error when processChatRequest returns unexpected result", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        unexpected: "result",
      });

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Unexpected error processing chat request");
    });

    it("should throw error when no response is generated", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        response: null,
      });

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("No response generated by the model");
    });

    it("should handle processChatRequest rejection", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;

      mockProcessChatRequest.mockRejectedValue(new Error("Processing failed"));

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Processing failed");
    });
  });

  describe("tool responses handling", () => {
    it("should include tool responses in choices", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        tools: [{ type: "function", function: { name: "test_tool" } }],
      } as any;

      const mockResponse = {
        response: {
          response: "Using tool",
          usage: { total_tokens: 50 },
        },
        selectedModel: "gpt-4",
        toolResponses: [
          {
            id: "tool_123",
            role: "tool",
            name: "test_tool",
            content: "Tool result",
            status: "success",
            timestamp: "2023-01-01T00:00:00Z",
          },
        ],
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);
      mockFormatAssistantMessage.mockReturnValue({
        content: "Using tool",
        model: "gpt-4",
        usage: { total_tokens: 50 },
        finish_reason: "stop",
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.choices).toHaveLength(2);
      // @ts-expect-error - mock result
      expect(result.choices[1]).toEqual({
        index: 1,
        message: {
          id: "tool_123",
          log_id: "test-log-id",
          role: "tool",
          name: "test_tool",
          content: "Tool result",
          citations: null,
          data: null,
          status: "success",
          timestamp: "2023-01-01T00:00:00Z",
        },
        finish_reason: "tool_result",
      });
    });
  });
});
