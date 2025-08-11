import { beforeEach, describe, expect, it, vi } from "vitest";

import { StreamingFormatter } from "../streaming";

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "mock-id-123"),
}));

describe("StreamingFormatter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractContentFromChunk", () => {
    it("should extract content from OpenAI-like streaming format", () => {
      const data = {
        choices: [{ delta: { content: "Hello world" } }],
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Hello world");
    });

    it("should handle null content in OpenAI format", () => {
      const data = {
        choices: [{ delta: { content: null } }],
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("");
    });

    it("should extract content from regular OpenAI message format", () => {
      const data = {
        choices: [{ message: { content: "Regular message" } }],
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Regular message");
    });

    it("should extract content from Google-style format", () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [{ text: "First part" }, { text: "Second part" }],
            },
          },
        ],
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("First part\nSecond part");
    });

    it("should handle Google executable code format", () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                { text: "Here's some code:" },
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

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toContain("Here's some code:");
      expect(result).toContain(
        '<artifact identifier="executable-code-1" type="application/code" language="python" title="Executable python Code">',
      );
      expect(result).toContain("print('hello')");
    });

    it("should handle Google code execution results", () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                {
                  codeExecutionResult: {
                    output: "Execution output here",
                  },
                },
              ],
            },
          },
        ],
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("\n\nExecution output here\n\n");
    });

    it("should extract content from Anthropic text_delta format", () => {
      const data = {
        delta: { type: "text_delta", text: "Anthropic text" },
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Anthropic text");
    });

    it("should extract content from Anthropic content_block_delta format", () => {
      const data = {
        delta: { type: "text_delta", text: "Delta text" },
      };

      const result = StreamingFormatter.extractContentFromChunk(
        data,
        "content_block_delta",
      );

      expect(result).toBe("Delta text");
    });

    it("should extract content from array of message content blocks", () => {
      const data = {
        message: {
          content: [
            { type: "text", text: "First block" },
            { type: "text", text: "Second block" },
            { type: "other", data: "ignored" },
          ],
        },
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("First blockSecond block");
    });

    it("should extract content from direct content field", () => {
      const data = { content: "Direct content" };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Direct content");
    });

    it("should extract content from response field", () => {
      const data = { response: "Response content" };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Response content");
    });

    it("should extract content from Ollama-like format", () => {
      const data = {
        message: { content: "Ollama message" },
      };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Ollama message");
    });

    it("should extract content from direct text field", () => {
      const data = { text: "Direct text" };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("Direct text");
    });

    it("should return empty string for unrecognized formats", () => {
      const data = { unknown: "field" };

      const result = StreamingFormatter.extractContentFromChunk(data);

      expect(result).toBe("");
    });
  });

  describe("extractThinkingFromChunk", () => {
    it("should extract thinking from content_block_delta with thinking_delta", () => {
      const data = {
        delta: { type: "thinking_delta", thinking: "I'm thinking..." },
      };

      const result = StreamingFormatter.extractThinkingFromChunk(
        data,
        "content_block_delta",
      );

      expect(result).toBe("I'm thinking...");
    });

    it("should extract signature from content_block_delta with signature_delta", () => {
      const data = {
        delta: { type: "signature_delta", signature: "signature_data" },
      };

      const result = StreamingFormatter.extractThinkingFromChunk(
        data,
        "content_block_delta",
      );

      expect(result).toEqual({
        type: "signature",
        signature: "signature_data",
      });
    });

    it("should return null for non-matching event types", () => {
      const data = {
        delta: { type: "thinking_delta", thinking: "thinking" },
      };

      const result = StreamingFormatter.extractThinkingFromChunk(
        data,
        "other_event",
      );

      expect(result).toBeNull();
    });

    it("should return null for unrecognized formats", () => {
      const data = { unknown: "field" };

      const result = StreamingFormatter.extractThinkingFromChunk(
        data,
        "content_block_delta",
      );

      expect(result).toBeNull();
    });
  });

  describe("extractToolCall", () => {
    it("should extract OpenAI-style tool calls", () => {
      const data = {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "test_func",
                    arguments: '{"arg": "value"}',
                  },
                },
              ],
            },
          },
        ],
      };

      const result = StreamingFormatter.extractToolCall(data);

      expect(result).toEqual({
        format: "openai",
        toolCalls: [
          {
            id: "call_123",
            type: "function",
            function: { name: "test_func", arguments: '{"arg": "value"}' },
          },
        ],
      });
    });

    it("should extract Google-style function calls", () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                { text: "Some text" },
                {
                  functionCall: {
                    name: "google_func",
                    args: { param: "value" },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = StreamingFormatter.extractToolCall(data);

      expect(result).toEqual({
        format: "direct",
        toolCalls: [
          {
            id: "call_mock-id-123",
            type: "function",
            function: {
              name: "google_func",
              arguments: '{"param":"value"}',
            },
          },
        ],
      });
    });

    it("should handle Google function calls with no args", () => {
      const data = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "no_args_func",
                  },
                },
              ],
            },
          },
        ],
      };

      const result = StreamingFormatter.extractToolCall(data);

      expect(result?.toolCalls[0].function.arguments).toBe("{}");
    });

    it("should extract Anthropic-style tool_use blocks", () => {
      const data = {
        content_block: {
          type: "tool_use",
          id: "toolu_123",
          name: "anthropic_tool",
        },
        index: 0,
      };

      const result = StreamingFormatter.extractToolCall(
        data,
        "content_block_start",
      );

      expect(result).toEqual({
        format: "anthropic",
        id: "toolu_123",
        name: "anthropic_tool",
        index: 0,
      });
    });

    it("should extract Anthropic tool input updates", () => {
      const data = {
        delta: {
          type: "input_json_delta",
          partial_json: '{"key": "val',
        },
        index: 1,
      };

      const result = StreamingFormatter.extractToolCall(
        data,
        "content_block_delta",
      );

      expect(result).toEqual({
        format: "anthropic_delta",
        index: 1,
        partial_json: '{"key": "val',
      });
    });

    it("should extract direct tool_calls format", () => {
      const data = {
        tool_calls: [{ id: "direct_call", name: "direct_tool" }],
      };

      const result = StreamingFormatter.extractToolCall(data);

      expect(result).toEqual({
        format: "direct",
        toolCalls: [{ id: "direct_call", name: "direct_tool" }],
      });
    });

    it("should return null for unrecognized formats", () => {
      const data = { unknown: "field" };

      const result = StreamingFormatter.extractToolCall(data);

      expect(result).toBeNull();
    });
  });

  describe("isCompletionIndicated", () => {
    it("should return true for OpenAI stop finish reason", () => {
      const data = {
        choices: [{ finish_reason: "stop" }],
      };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(true);
    });

    it("should return true for OpenAI length finish reason", () => {
      const data = {
        choices: [{ finish_reason: "length" }],
      };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(true);
    });

    it("should handle camelCase finishReason", () => {
      const data = {
        choices: [{ finishReason: "STOP" }],
      };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(true);
    });

    it("should return true for Google stop finish reason", () => {
      const data = {
        candidates: [{ finishReason: "STOP" }],
      };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(true);
    });

    it("should return true for Google length finish reason", () => {
      const data = {
        candidates: [{ finishReason: "LENGTH" }],
      };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(true);
    });

    it("should return false for other finish reasons", () => {
      const data = {
        choices: [{ finish_reason: "function_call" }],
      };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(false);
    });

    it("should return false when no finish reason present", () => {
      const data = { other: "field" };

      const result = StreamingFormatter.isCompletionIndicated(data);

      expect(result).toBe(false);
    });
  });

  describe("extractUsageData", () => {
    it("should extract usage data from usage field", () => {
      const data = {
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = StreamingFormatter.extractUsageData(data);

      expect(result).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });

    it("should extract usage data from usageMetadata field", () => {
      const data = {
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8 },
      };

      const result = StreamingFormatter.extractUsageData(data);

      expect(result).toEqual({
        promptTokenCount: 20,
        candidatesTokenCount: 8,
      });
    });

    it("should return null when no usage data present", () => {
      const data = { other: "field" };

      const result = StreamingFormatter.extractUsageData(data);

      expect(result).toBeNull();
    });
  });

  describe("extractCitations", () => {
    it("should extract citations array", () => {
      const citations = [
        { source: "example.com", title: "Example" },
        { source: "test.com", title: "Test" },
      ];
      const data = { citations };

      const result = StreamingFormatter.extractCitations(data);

      expect(result).toEqual(citations);
    });

    it("should extract Google search grounding citations", () => {
      const data = {
        candidates: [
          {
            groundingMetadata: {
              searchEntryPoint: { renderedContent: "Search results" },
              groundingChunks: [
                { web: { uri: "https://example.com", title: "Example Page" } },
                { web: { uri: "https://test.com", title: "Test Page" } },
              ],
            },
          },
        ],
      };

      const result = StreamingFormatter.extractCitations(data);

      expect(result).toEqual([
        {
          searchGrounding: {
            groundingChunks: [
              {
                web: {
                  uri: "https://example.com",
                  title: "Example Page",
                },
              },
              {
                web: {
                  uri: "https://test.com",
                  title: "Test Page",
                },
              },
            ],
            searchEntryPoint: {
              renderedContent: undefined,
            },
            groundingSupports: {},
          },
        },
      ]);
    });

    it("should return empty array when no citations present", () => {
      const data = { other: "field" };

      const result = StreamingFormatter.extractCitations(data);

      expect(result).toEqual([]);
    });
  });

  describe("extractStructuredData", () => {
    it("should extract structured data from Google grounding metadata", () => {
      const data = {
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://example.com", title: "Example" } },
              ],
              searchEntryPoint: { renderedContent: "Search results" },
            },
          },
        ],
      };

      const result = StreamingFormatter.extractStructuredData(data);

      expect(result).toEqual({
        searchGrounding: {
          groundingChunks: [
            { web: { uri: "https://example.com", title: "Example" } },
          ],
          searchEntryPoint: {
            renderedContent: undefined,
          },
          groundingSupports: {},
        },
      });
    });

    it("should return null when no structured data present", () => {
      const data = { other: "field" };

      const result = StreamingFormatter.extractStructuredData(data);

      expect(result).toBeNull();
    });
  });

  describe("extractRefusalFromChunk", () => {
    it("should extract refusal from OpenAI delta", () => {
      const data = { choices: [{ delta: { refusal: "content_policy_violation" } }] };
      const result = StreamingFormatter.extractRefusalFromChunk(data);
      expect(result).toBe("content_policy_violation");
    });

    it("should extract refusal from OpenAI message", () => {
      const data = { choices: [{ message: { refusal: "blocked" } }] };
      const result = StreamingFormatter.extractRefusalFromChunk(data);
      expect(result).toBe("blocked");
    });

    it("should return null when refusal is missing", () => {
      const data = { choices: [{ delta: { content: "hi" } }] };
      const result = StreamingFormatter.extractRefusalFromChunk(data);
      expect(result).toBeNull();
    });
  });

  describe("extractAnnotationsFromChunk", () => {
    it("should extract annotations from OpenAI delta", () => {
      const data = { choices: [{ delta: { annotations: [{ type: "citation" }] } }] };
      const result = StreamingFormatter.extractAnnotationsFromChunk(data);
      expect(result).toEqual([{ type: "citation" }]);
    });

    it("should extract annotations from OpenAI message", () => {
      const data = { choices: [{ message: { annotations: { key: "val" } } }] };
      const result = StreamingFormatter.extractAnnotationsFromChunk(data);
      expect(result).toEqual({ key: "val" });
    });

    it("should return null when annotations are missing", () => {
      const data = { other: "field" };
      const result = StreamingFormatter.extractAnnotationsFromChunk(data);
      expect(result).toBeNull();
    });
  });
});
