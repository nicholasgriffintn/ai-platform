import { describe, expect, it, vi } from "vitest";

import { parseServerSentEventBuffer } from "./server-sent-events.js";

describe("parseServerSentEventBuffer", () => {
  it("parses complete events and ignores the completion marker", () => {
    const onEvent = vi.fn();
    const remaining = parseServerSentEventBuffer<{ type: string }>(
      `data: {"type":"run_started"}\n\n` +
        `data: {"type":"run_completed"}\n\n` +
        `data: [DONE]\n\n`,
      { onEvent },
    );

    expect(remaining).toBe("");
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: "run_started" },
      { type: "run_completed" },
    ]);
  });

  it("returns an incomplete trailing event for the next parse cycle", () => {
    const onEvent = vi.fn();
    const remaining = parseServerSentEventBuffer<{ type: string }>(
      `data: {"type":"run_started"}\n\ndata: {"type":"run`,
      { onEvent },
    );

    expect(onEvent).toHaveBeenCalledOnce();
    expect(remaining).toBe(`data: {"type":"run`);
  });
});
