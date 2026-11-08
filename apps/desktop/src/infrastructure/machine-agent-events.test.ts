import { describe, expect, it } from "vitest";

import { createMachineAgentEvents } from "./machine-agent-events";

describe("createMachineAgentEvents", () => {
  it("turns running usage totals into increments so the server does not double count", () => {
    const events = createMachineAgentEvents();
    const usage = (input: number, output: number) =>
      events.usage({
        inputTokens: input,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        outputTokens: output,
        reasoningOutputTokens: 0,
      });

    usage(100, 10);
    usage(100, 10);
    usage(150, 30);

    expect(events.peek(10)).toEqual([
      { type: "usage", inputTokens: 100, outputTokens: 10 },
      { type: "usage", inputTokens: 50, outputTokens: 20 },
    ]);
  });
});
