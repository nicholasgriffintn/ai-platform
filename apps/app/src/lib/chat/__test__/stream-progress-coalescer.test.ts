import { describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";

import { createStreamProgressCoalescer, type FlushScheduler } from "../stream-progress-coalescer";

function createManualScheduler() {
  let queued: (() => void) | null = null;
  let cancelled = 0;

  const scheduleFlush: FlushScheduler = (callback) => {
    queued = callback;

    return {
      cancel: () => {
        if (queued === callback) {
          queued = null;
          cancelled += 1;
        }
      },
    };
  };

  return {
    scheduleFlush,
    get cancelledCount() {
      return cancelled;
    },
    get isPending() {
      return queued !== null;
    },
    runFrame() {
      const callback = queued;

      queued = null;
      callback?.();
    },
  };
}

const finalMessage = { id: "assistant-1", role: "assistant", content: "Hello world" } as Message;
const toolMessage = { id: "tool-1", role: "tool", content: "{}" } as Message;

describe("createStreamProgressCoalescer", () => {
  it("delivers only the latest accumulated delta per frame", () => {
    const onUpdate = vi.fn();
    const scheduler = createManualScheduler();
    const coalescer = createStreamProgressCoalescer(onUpdate, scheduler.scheduleFlush);

    coalescer.handleUpdate("He");
    coalescer.handleUpdate("Hello");
    coalescer.handleUpdate("Hello wo");

    expect(onUpdate).not.toHaveBeenCalled();

    scheduler.runFrame();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith("Hello wo", undefined);
  });

  it("reduces a representative ten-thousand-delta burst to one render", () => {
    const onUpdate = vi.fn();
    const scheduler = createManualScheduler();
    const coalescer = createStreamProgressCoalescer(onUpdate, scheduler.scheduleFlush);

    for (let index = 1; index <= 10_000; index += 1) {
      coalescer.handleUpdate(`token-${index}`);
    }

    scheduler.runFrame();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith("token-10000", undefined);
  });

  it("flushes the pending delta before the final message so no content is stranded", () => {
    const onUpdate = vi.fn();
    const scheduler = createManualScheduler();
    const coalescer = createStreamProgressCoalescer(onUpdate, scheduler.scheduleFlush);

    coalescer.handleUpdate("Hello");
    coalescer.handleUpdate("Hello world");
    coalescer.handleUpdate("Hello world", undefined, undefined, true, finalMessage);

    expect(onUpdate.mock.calls).toEqual([
      ["Hello world", undefined],
      ["Hello world", undefined, undefined, true, finalMessage],
    ]);
    expect(scheduler.isPending).toBe(false);
  });

  it("passes tool results through in order rather than merging them into text", () => {
    const onUpdate = vi.fn();
    const scheduler = createManualScheduler();
    const coalescer = createStreamProgressCoalescer(onUpdate, scheduler.scheduleFlush);

    coalescer.handleUpdate("Looking that up");
    coalescer.handleUpdate("", "", [toolMessage]);
    coalescer.handleUpdate("Looking that up. Done");
    scheduler.runFrame();

    expect(onUpdate.mock.calls).toEqual([
      ["Looking that up", undefined],
      ["", "", [toolMessage], undefined, undefined],
      ["Looking that up. Done", undefined],
    ]);
  });

  it("flushes and cancels the scheduled frame when the stream stops", () => {
    const onUpdate = vi.fn();
    const scheduler = createManualScheduler();
    const coalescer = createStreamProgressCoalescer(onUpdate, scheduler.scheduleFlush);

    coalescer.handleUpdate("Partial answer");
    coalescer.stop();

    expect(onUpdate).toHaveBeenCalledWith("Partial answer", undefined);
    expect(scheduler.isPending).toBe(false);
    expect(scheduler.cancelledCount).toBe(1);

    scheduler.runFrame();

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("delivers updates synchronously once stopped", () => {
    const onUpdate = vi.fn();
    const scheduler = createManualScheduler();
    const coalescer = createStreamProgressCoalescer(onUpdate, scheduler.scheduleFlush);

    coalescer.stop();
    coalescer.handleUpdate("late delta");

    expect(onUpdate).toHaveBeenCalledWith("late delta", undefined, undefined, undefined, undefined);
    expect(scheduler.isPending).toBe(false);
  });
});
