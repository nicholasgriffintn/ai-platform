import { describe, expect, it } from "vitest";

import { createMachineAgentEvents } from "./machine-agent-events";

describe("createMachineAgentEvents", () => {
  it("sends only the new part of the reply and each step's start and finish", () => {
    const events = createMachineAgentEvents();

    events.text("Che");
    events.text("Checking");
    events.item({
      id: "tool-1",
      status: "running",
      body: { kind: "command", command: "ls", output: "", exitCode: null },
    });
    events.item({
      id: "tool-1",
      status: "completed",
      body: { kind: "command", command: "ls", output: "README.md", exitCode: 0 },
    });

    expect(events.peek(10)).toEqual([
      { type: "text-delta", partId: "message", delta: "Che" },
      { type: "text-delta", partId: "message", delta: "cking" },
      {
        type: "tool-started",
        toolCallId: "tool-1",
        toolName: "command",
        input: { command: "ls" },
      },
      { type: "tool-finished", toolCallId: "tool-1", toolName: "command", output: "README.md" },
    ]);
  });

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
