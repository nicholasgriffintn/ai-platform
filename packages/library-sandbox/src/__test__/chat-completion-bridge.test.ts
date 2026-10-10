import { describe, expect, it } from "vitest";

import {
  toOpenAICompletion,
  toOpenAICompletionStream,
  toPolychatCompletionRequest,
} from "../chat-completion-bridge.js";

describe("chat completion bridge", () => {
  it("lets Polychat choose the model and keeps agent traffic out of conversations", () => {
    const bridged = toPolychatCompletionRequest(
      {
        model: "polychat",
        reasoning_effort: "xhigh",
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "user", content: "hi" }],
        tools: [{ type: "function", function: { name: "terminal" } }],
      },
      "medium",
    );

    expect(bridged.stream).toBe(true);
    expect(bridged.body).toEqual({
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: "terminal" } }],
      model_tier: "medium",
      stream: false,
      store: false,
      enabled_tools: [],
    });
  });

  it("returns caller tool calls in the shape OpenAI clients parse", () => {
    const completion = toOpenAICompletion(
      {
        id: "cmpl_1",
        created: 10,
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "terminal", arguments: { cmd: "ls" } },
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      },
      "polychat",
    );

    expect(completion?.choices[0]).toEqual({
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "terminal", arguments: '{"cmd":"ls"}' },
          },
        ],
      },
      finish_reason: "tool_calls",
    });

    const frames = toOpenAICompletionStream(completion!).trim().split("\n\n");

    expect(frames.at(-1)).toBe("data: [DONE]");
    expect(JSON.parse(frames[0].slice(6)).choices[0].delta.tool_calls[0]).toMatchObject({
      index: 0,
      id: "call_1",
    });
    expect(JSON.parse(frames[1].slice(6))).toMatchObject({
      choices: [{ finish_reason: "tool_calls" }],
      usage: { total_tokens: 5 },
    });
  });

  it("rejects payloads without a choice", () => {
    expect(toOpenAICompletion({ error: "nope" }, "polychat")).toBeNull();
  });
});
