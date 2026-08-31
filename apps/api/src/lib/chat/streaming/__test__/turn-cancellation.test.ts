import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { watchDetachedTurnCancellation } from "../turn-cancellation";

function createCache(cancelledAtMs: number | null) {
  return {
    get: vi.fn(async () => (cancelledAtMs === null ? null : String(cancelledAtMs))),
    put: vi.fn(async () => {}),
  };
}

describe("watchDetachedTurnCancellation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("honours cancellation requested well past the previous 5-tick, 5-second window", async () => {
    const cache = createCache(null);
    const signal = watchDetachedTurnCancellation({
      env: { CACHE: cache } as unknown as IEnv,
      completionId: "completion-1",
      isDetached: () => true,
    });

    await vi.advanceTimersByTimeAsync(20_000);

    expect(signal.shouldStop()).toBe(false);
    expect(cache.get.mock.calls.length).toBeGreaterThan(5);

    cache.get.mockImplementation(async () => String(Date.now()));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(signal.shouldStop()).toBe(true);

    signal.stop();
  });

  it("stops polling once the turn ends, leaving no dangling timer", async () => {
    const cache = createCache(null);
    const signal = watchDetachedTurnCancellation({
      env: { CACHE: cache } as unknown as IEnv,
      completionId: "completion-1",
      isDetached: () => true,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    const callsBeforeStop = cache.get.mock.calls.length;

    expect(callsBeforeStop).toBeGreaterThan(0);

    signal.stop();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(cache.get.mock.calls.length).toBe(callsBeforeStop);
  });

  it("skips polling KV while the turn is attached", async () => {
    const cache = createCache(null);
    let detached = false;
    const signal = watchDetachedTurnCancellation({
      env: { CACHE: cache } as unknown as IEnv,
      completionId: "completion-1",
      isDetached: () => detached,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(cache.get).not.toHaveBeenCalled();

    detached = true;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cache.get).toHaveBeenCalled();

    signal.stop();
  });
});
