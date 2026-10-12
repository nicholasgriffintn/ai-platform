import { describe, expect, it } from "vitest";

import { modelChunkToHarnessEvents } from "../model-stream";

describe("modelChunkToHarnessEvents", () => {
  it("turns OpenAI chunks into reasoning, text and usage events for one model call", () => {
    expect(
      modelChunkToHarnessEvents(
        { choices: [{ delta: { reasoning_content: "thinking", content: "Hello" } }] },
        "call-1",
      ),
    ).toEqual([
      { type: "reasoning-delta", partId: "call-1", delta: "thinking" },
      { type: "text-delta", partId: "call-1", delta: "Hello" },
    ]);
    expect(
      modelChunkToHarnessEvents(
        { choices: [], usage: { prompt_tokens: 120, completion_tokens: 30 } },
        "call-1",
      ),
    ).toEqual([{ type: "usage", inputTokens: 120, outputTokens: 30 }]);
  });

  it("ignores tool call deltas and malformed chunks", () => {
    expect(
      modelChunkToHarnessEvents(
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{" } }] } }] },
        "call-1",
      ),
    ).toEqual([]);
    expect(modelChunkToHarnessEvents("not json", "call-1")).toEqual([]);
  });
});
