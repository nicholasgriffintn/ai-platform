import { describe, expect, it } from "vitest";

import { ResponseFormatter } from "./responses";
import { StreamingFormatter } from "./streaming";

describe("ResponseFormatter Google AI Studio tool calls", () => {
  it("normalises function calls for the shared tool renderer", async () => {
    const response = await ResponseFormatter.formatResponse(
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    id: "call-123",
                    name: "get_weather",
                    args: { location: "London" },
                  },
                  thoughtSignature: "signed-response-thought",
                },
              ],
            },
          },
        ],
      },
      "google-ai-studio",
    );

    expect(response.tool_calls).toEqual([
      {
        id: "call-123",
        type: "function",
        thought_signature: "signed-response-thought",
        function: {
          name: "get_weather",
          arguments: '{"location":"London"}',
        },
      },
    ]);
  });
});

describe("StreamingFormatter Google AI Studio tool calls", () => {
  it("preserves Google's function call id", () => {
    const toolCall = StreamingFormatter.extractToolCall({
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  id: "call-456",
                  name: "get_weather",
                  args: { location: "London" },
                },
                thoughtSignature: "signed-stream-thought",
              },
            ],
          },
        },
      ],
    });

    expect(toolCall).toEqual({
      format: "direct",
      toolCalls: [
        {
          id: "call-456",
          type: "function",
          thought_signature: "signed-stream-thought",
          function: {
            name: "get_weather",
            arguments: '{"location":"London"}',
          },
        },
      ],
    });
  });

  it("renders native code execution parts from Google's stream", () => {
    const content = StreamingFormatter.extractContentFromChunk({
      candidates: [
        {
          content: {
            parts: [
              {
                executableCode: {
                  language: "PYTHON",
                  code: "print(5117)",
                },
              },
              {
                codeExecutionResult: {
                  outcome: "OUTCOME_OK",
                  output: "5117",
                },
              },
            ],
          },
        },
      ],
    });

    expect(content).toContain('title="Executable python Code"');
    expect(content).toContain("print(5117)");
    expect(content).toContain("5117");
  });
});

describe("Mistral reasoning content", () => {
  const content = [
    {
      type: "thinking",
      thinking: [{ type: "text", text: "Working it through" }],
    },
    { type: "text", text: "Final answer" },
  ];

  it("normalises buffered thinking chunks", async () => {
    const response = await ResponseFormatter.formatResponse(
      {
        choices: [{ message: { role: "assistant", content } }],
      },
      "mistral",
    );

    expect(response.response).toBe("Final answer");
    expect(response.thinking).toBe("Working it through");
  });

  it("separates streamed thinking from answer text", () => {
    const chunk = { choices: [{ delta: { content } }] };

    expect(StreamingFormatter.extractContentFromChunk(chunk)).toBe("Final answer");
    expect(StreamingFormatter.extractThinkingFromChunk(chunk)).toBe("Working it through");
  });
});
