import { describe, expect, it } from "vitest";

import {
  buildOpenAIHostedToolParts,
  buildOpenAIResponseOutputParts,
} from "../openai-response-parts";

describe("OpenAI Responses message parts", () => {
  it.each([
    ["code_interpreter_call", "code_execution"],
    ["web_search_call", "search_grounding"],
    ["file_search_call", "file_search"],
    ["shell_call", "hosted_shell"],
    ["tool_search_call", "tool_search"],
    ["mcp_call", "mcp"],
    ["image_generation_call", "image_generation"],
    ["computer_call", "computer_use"],
  ])("maps %s to a visible %s result", (type, name) => {
    const parts = buildOpenAIHostedToolParts({
      id: `${type}-1`,
      type,
      status: "completed",
      action: { query: "example" },
      results: [{ value: "result" }],
    });

    expect(parts).toEqual([
      expect.objectContaining({ type: "tool_use", name }),
      expect.objectContaining({ type: "tool_result", name, status: "completed" }),
    ]);
  });

  it("preserves output order without exposing generated image base64 as tool text", () => {
    const parts = buildOpenAIResponseOutputParts([
      {
        id: "reasoning-1",
        type: "reasoning",
        summary: [{ type: "summary_text", text: "Short safe summary." }],
      },
      {
        id: "image-1",
        type: "image_generation_call",
        status: "completed",
        result: "large-base64-payload",
      },
    ]);

    expect(parts[0]).toMatchObject({ type: "reasoning", text: "Short safe summary." });
    expect(parts[2]).toMatchObject({
      type: "tool_result",
      name: "image_generation",
      content: "Image generated.",
    });
  });

  it("pairs shell calls with readable output from the separate output item", () => {
    const parts = buildOpenAIResponseOutputParts([
      {
        id: "shell-call-1",
        call_id: "call-1",
        type: "shell_call",
        status: "completed",
        action: { commands: ["printf shell-validation-ok"] },
      },
      {
        id: "shell-output-1",
        call_id: "call-1",
        type: "shell_call_output",
        status: "completed",
        output: [
          {
            stdout: "shell-validation-ok",
            stderr: "",
            outcome: { type: "exit", exit_code: 0 },
          },
        ],
      },
    ]);

    expect(parts).toEqual([
      expect.objectContaining({ type: "tool_use", name: "hosted_shell", toolCallId: "call-1" }),
      expect.objectContaining({
        type: "tool_result",
        name: "hosted_shell",
        toolCallId: "call-1",
        content: "shell-validation-ok",
      }),
    ]);
  });

  it("shows a compact list for separately returned tool-search results", () => {
    const parts = buildOpenAIResponseOutputParts([
      {
        id: "tool-search-call-1",
        call_id: "call-2",
        type: "tool_search_call",
        status: "completed",
        arguments: { query: "news" },
      },
      {
        id: "tool-search-output-1",
        call_id: "call-2",
        type: "tool_search_output",
        status: "completed",
        tools: [
          {
            type: "function",
            name: "get_hacker_news_stories",
            description: "Gets Hacker News stories.",
            parameters: { type: "object" },
          },
        ],
      },
    ]);

    expect(parts).toEqual([
      expect.objectContaining({ type: "tool_use", name: "tool_search", toolCallId: "call-2" }),
      expect.objectContaining({
        type: "tool_result",
        name: "tool_search",
        toolCallId: "call-2",
        content: "get_hacker_news_stories — Gets Hacker News stories.",
      }),
    ]);
  });

  it("pairs tool-search items when OpenAI omits their nullable call ids", () => {
    const parts = buildOpenAIResponseOutputParts([
      {
        id: "tsc_1",
        call_id: null,
        type: "tool_search_call",
        status: "completed",
        arguments: { query: "news" },
      },
      {
        id: "tso_1",
        call_id: null,
        type: "tool_search_output",
        status: "completed",
        tools: [{ type: "function", name: "get_hacker_news_stories" }],
      },
    ]);

    expect(parts).toEqual([
      expect.objectContaining({ type: "tool_use", toolCallId: "tsc_1" }),
      expect.objectContaining({
        type: "tool_result",
        toolCallId: "tsc_1",
        content: "get_hacker_news_stories",
      }),
    ]);
  });
});
