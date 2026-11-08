import { describe, expect, it, vi } from "vitest";

import { parseServerSentEventBuffer } from "./server-sent-events.js";

describe("parseServerSentEventBuffer", () => {
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
