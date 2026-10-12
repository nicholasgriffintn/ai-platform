import { describe, expect, it } from "vitest";

import { expiresAtMs, isTokenStale } from "./session-refresh";

describe("desktop session refresh", () => {
  it("treats a token inside the safety margin as stale so waking renews it", () => {
    const now = 1_000_000;

    expect(isTokenStale(expiresAtMs(15 * 60, now), now)).toBe(false);
    expect(isTokenStale(expiresAtMs(119, now), now)).toBe(true);
    expect(isTokenStale(expiresAtMs(0, now), now)).toBe(true);
  });
});
