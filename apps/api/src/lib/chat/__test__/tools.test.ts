import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/functions", () => ({
  handleFunctions: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "test-id-123"),
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("~/utils/tool-responses", () => ({
  formatToolErrorResponse: vi.fn((name, message, type) => ({
    content: `Error in ${name}: ${message}`,
    data: { error: type },
  })),
  formatToolResponse: vi.fn((name, content, data) => ({
    content: `Result from ${name}: ${content}`,
    data: data || {},
  })),
}));

import { handleFunctions } from "~/services/functions";
import { formatToolErrorResponse } from "~/utils/tool-responses";
import { formatToolCalls, handleToolCalls } from "../tools";

describe("tools", () => {
  const mockConversationManager = {
    addBatch: vi.fn(),
  };

  const mockRequest = {
    env: { AI: { aiGatewayLogId: "log-123" } },
    app_url: "https://test.com",
    request: { model: "gpt-4", platform: "api" },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe("handleToolCalls", () => {
    it("should return empty array when no tool calls", async () => {
      const modelResponse = {};

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when tool calls is empty", async () => {
      const modelResponse = { tool_calls: [] };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toEqual([]);
    });

    it("should handle memory tool calls", async () => {
      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "memory",
              arguments: JSON.stringify({
                type: "store",
                category: "facts",
                text: "Important information",
              }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "tool",
        name: "memory",
        content: "📝 Stored facts memory: Important information",
        status: "success",
        data: {
          type: "store",
          category: "facts",
          text: "Important information",
        },
        log_id: "log-123",
        id: "test-id-123",
        tool_call_id: "call-1",
        tool_call_arguments: JSON.stringify({
          type: "store",
          category: "facts",
          text: "Important information",
        }),
        timestamp: expect.any(Number),
        model: "gpt-4",
        platform: "api",
      });
    });

    it("should handle memory tool with snapshot type", async () => {
      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "memory",
              arguments: JSON.stringify({ type: "snapshot" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result[0].content).toBe("🔍 Created memory snapshot");
    });

    it("should handle successful function calls", async () => {
      vi.mocked(handleFunctions).mockResolvedValue({
        content: "Function executed successfully",
        data: { result: "test" },
        status: "success",
      });

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test query" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(handleFunctions).toHaveBeenCalledWith({
        completion_id: "completion-123",
        app_url: "https://test.com",
        functionName: "search",
        args: { query: "test query" },
        request: mockRequest,
        conversationManager: mockConversationManager,
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("tool");
      expect(result[0].name).toBe("search");
      expect(result[0].status).toBe("success");
    });

    it("should handle tool call with missing ID", async () => {
      const modelResponse = {
        tool_calls: [
          {
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("error");
      expect(formatToolErrorResponse).toHaveBeenCalledWith(
        "search",
        "Missing tool call ID",
        "TOOL_CALL_ERROR",
      );
    });

    it("should handle invalid JSON in tool arguments", async () => {
      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: "invalid json{",
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("error");
      expect(formatToolErrorResponse).toHaveBeenCalledWith(
        "search",
        expect.stringContaining("Invalid arguments for search"),
        "TOOL_CALL_ERROR",
      );
    });

    it("should handle memory tool with invalid JSON", async () => {
      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "memory",
              arguments: "invalid json{",
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("error");
      expect(formatToolErrorResponse).toHaveBeenCalledWith(
        "memory",
        expect.stringContaining("Invalid memory tool arguments"),
        "TOOL_CALL_ERROR",
      );
    });

    it("should handle function execution errors", async () => {
      const functionError = new Error("Function failed");
      (functionError as any).type = "RATE_LIMIT_ERROR";
      vi.mocked(handleFunctions).mockRejectedValue(functionError);

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("error");
      expect(formatToolErrorResponse).toHaveBeenCalledWith(
        "search",
        "Function failed",
        "RATE_LIMIT_ERROR",
      );
    });

    it("should handle null function result", async () => {
      vi.mocked(handleFunctions).mockResolvedValue(null);

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("error");
      expect(formatToolErrorResponse).toHaveBeenCalledWith(
        "search",
        "Tool returned no result",
        "EMPTY_RESULT",
      );
    });

    it("should handle alternative tool call format", async () => {
      vi.mocked(handleFunctions).mockResolvedValue({
        content: "Success",
        status: "success",
      });

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            name: "search",
            arguments: JSON.stringify({ query: "test" }),
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("search");
    });

    it("should handle invalid arguments format", async () => {
      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify("not an object"),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("error");
      expect(formatToolErrorResponse).toHaveBeenCalledWith(
        "search",
        expect.stringContaining("Invalid arguments format for search"),
        "TOOL_CALL_ERROR",
      );
    });

    it("should store tool call results in conversation manager", async () => {
      vi.mocked(handleFunctions).mockResolvedValue({
        content: "Success",
        status: "success",
      });

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test" }),
            },
          },
        ],
      };

      await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(mockConversationManager.addBatch).toHaveBeenCalledWith(
        "completion-123",
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "search",
          }),
        ]),
      );
    });

    it("should handle conversation manager errors gracefully", async () => {
      vi.mocked(handleFunctions).mockResolvedValue({
        content: "Success",
        status: "success",
      });
      mockConversationManager.addBatch.mockRejectedValue(
        new Error("Storage failed"),
      );

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        mockRequest as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("success");
    });

    it("should handle missing env.AI.aiGatewayLogId", async () => {
      vi.mocked(handleFunctions).mockResolvedValue({
        content: "Success",
        status: "success",
      });

      const requestWithoutLogId = {
        ...mockRequest,
        env: { AI: {} },
      };

      const modelResponse = {
        tool_calls: [
          {
            id: "call-1",
            function: {
              name: "search",
              arguments: JSON.stringify({ query: "test" }),
            },
          },
        ],
      };

      const result = await handleToolCalls(
        "completion-123",
        modelResponse,
        mockConversationManager as any,
        requestWithoutLogId as any,
      );

      expect(result[0].log_id).toBe("");
    });
  });

  describe("formatToolCalls", () => {
    const sampleFunctions = [
      {
        name: "search",
        description: "Search the web",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "calculator",
        description: "Perform calculations",
        parameters: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Math expression" },
          },
          required: ["expression"],
        },
      },
    ];

    it("should format tools for anthropic provider", () => {
      const result = formatToolCalls("anthropic", sampleFunctions);

      expect(result).toEqual([
        {
          name: "search",
          description: "Search the web",
          input_schema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
            },
            required: ["query"],
          },
        },
        {
          name: "calculator",
          description: "Perform calculations",
          input_schema: {
            type: "object",
            properties: {
              expression: { type: "string", description: "Math expression" },
            },
            required: ["expression"],
          },
        },
      ]);
    });

    it("should format tools for openai provider", () => {
      const result = formatToolCalls("openai", sampleFunctions);

      expect(result).toEqual([
        {
          type: "function",
          function: {
            name: "search",
            description: "Search the web",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
              },
              required: ["query"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculator",
            description: "Perform calculations",
            parameters: {
              type: "object",
              properties: {
                expression: { type: "string", description: "Math expression" },
              },
              required: ["expression"],
            },
          },
        },
      ]);
    });

    it("should handle functions with jsonSchema parameters", () => {
      const functionsWithJsonSchema = [
        {
          name: "test",
          description: "Test function",
          parameters: {
            jsonSchema: {
              type: "object",
              properties: { test: { type: "string" } },
            },
          },
        },
      ];

      const result = formatToolCalls("openai", functionsWithJsonSchema);

      // @ts-expect-error - test data
      expect(result[0].function.parameters).toEqual({
        type: "object",
        properties: { test: { type: "string" } },
      });
    });

    it("should format tools for bedrock nova models", () => {
      const result = formatToolCalls(
        "bedrock",
        sampleFunctions,
        "amazon.nova-pro-v1:0",
      );
      expect(result).toEqual([
        {
          toolSpec: {
            name: "search",
            description: "Search the web",
            inputSchema: {
              json: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query" },
                },
                required: ["query"],
              },
            },
          },
        },
        {
          toolSpec: {
            name: "calculator",
            description: "Perform calculations",
            inputSchema: {
              json: {
                type: "object",
                properties: {
                  expression: {
                    type: "string",
                    description: "Math expression",
                  },
                },
                required: ["expression"],
              },
            },
          },
        },
      ]);
    });

    it("should filter out functions without parameters for anthropic", () => {
      const invalidFunctions = [
        {
          name: "valid",
          description: "Valid function",
          parameters: { type: "object" },
        },
        {
          name: "invalid",
          description: "Invalid function",
        },
      ];

      const result = formatToolCalls("anthropic", invalidFunctions);

      expect(result).toHaveLength(1);
      // @ts-expect-error - test data
      expect(result[0].name).toBe("valid");
    });

    it("should filter out functions without parameters for openai", () => {
      const invalidFunctions = [
        {
          name: "valid",
          description: "Valid function",
          parameters: { type: "object" },
        },
        {
          name: "invalid",
          description: "Invalid function",
        },
      ];

      const result = formatToolCalls("openai", invalidFunctions);

      expect(result).toHaveLength(1);
      // @ts-expect-error - test data
      expect(result[0].function.name).toBe("valid");
    });

    it("should handle null or undefined functions", () => {
      expect(formatToolCalls("openai", null)).toEqual([]);
      expect(formatToolCalls("openai", undefined)).toEqual([]);
    });

    it("should handle empty functions array", () => {
      expect(formatToolCalls("openai", [])).toEqual([]);
      expect(formatToolCalls("anthropic", [])).toEqual([]);
    });

    it("should handle non-array functions", () => {
      // @ts-expect-error - test data
      expect(formatToolCalls("openai", "not an array")).toEqual([]);
    });
  });
});
