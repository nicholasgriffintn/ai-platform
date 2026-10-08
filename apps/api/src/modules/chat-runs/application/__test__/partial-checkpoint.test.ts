import { describe, expect, it, vi } from "vitest";

import { createPartialCheckpointSink } from "../partial-checkpoint";

function createHarness() {
  let clock = 0;
  const writes: string[] = [];
  const downstream = { writeEvent: vi.fn().mockResolvedValue(undefined) };
  const sink = createPartialCheckpointSink(
    downstream,
    async (content) => {
      writes.push(content);
    },
    { intervalMs: 1_000, now: () => clock },
  );

  return {
    sink,
    writes,
    downstream,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("createPartialCheckpointSink", () => {
  it("checkpoints the first text at once and then at most once per interval", async () => {
    const { sink, writes, advance } = createHarness();

    await sink.writeEvent("content_block_delta", { content: "Hello" });
    await sink.writeEvent("content_block_delta", { content: ", there" });
    advance(1_000);
    await sink.writeEvent("content_block_delta", { content: "!" });
    await sink.flush();

    expect(writes).toEqual(["Hello", "Hello, there!"]);
  });

  it("forgets text from a finished step when the next model step starts", async () => {
    const { sink, writes } = createHarness();

    await sink.writeEvent("content_block_delta", { content: "Checking the docs" });
    await sink.writeEvent("turn_activity", { kind: "model_step_started", step: 2 });
    await sink.flush();

    expect(writes).toEqual(["Checking the docs", ""]);
  });

  it("forwards every event and survives a failed checkpoint", async () => {
    const downstream = { writeEvent: vi.fn().mockResolvedValue(undefined) };
    const sink = createPartialCheckpointSink(downstream, () =>
      Promise.reject(new Error("D1 unavailable")),
    );

    await sink.writeEvent("content_block_delta", { content: "Hi" });
    await expect(sink.flush()).resolves.toBeUndefined();

    expect(downstream.writeEvent).toHaveBeenCalledWith("content_block_delta", { content: "Hi" });
  });
});
