import { afterEach, describe, expect, it, vi } from "vitest";

import { settleWithin } from "./delay";

describe("settleWithin", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the value when the promise settles in time", async () => {
    await expect(settleWithin(Promise.resolve("ready"), 50, "late")).resolves.toBe("ready");
  });

  it("returns the fallback when the promise is still pending", async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => undefined);
    const settled = settleWithin(pending, 250, undefined);

    await vi.advanceTimersByTimeAsync(250);

    await expect(settled).resolves.toBeUndefined();
  });

  it("propagates a rejection that arrives in time", async () => {
    await expect(settleWithin(Promise.reject(new Error("down")), 50, null)).rejects.toThrow("down");
  });
});
