import { describe, expect, it } from "vitest";

import { expiresAtMs, isTokenStale, refreshDelayMs } from "./session-refresh";

const MINIMUM_DELAY_MS = 30 * 1000;

describe("desktop session refresh", () => {
  it("renews a fifteen minute token before the API stops reissuing it", () => {
    expect(refreshDelayMs(15 * 60)).toBe(13 * 60 * 1000);
  });

  it("renews before expiry for every lifetime long enough to allow it", () => {
    for (const lifetime of [180, 300, 900, 3600, 86_400]) {
      expect(refreshDelayMs(lifetime)).toBeLessThan(lifetime * 1000);
    }
  });

  it("keeps renewals apart when the API reports an unusably short lifetime", () => {
    expect(refreshDelayMs(10)).toBe(MINIMUM_DELAY_MS);
    expect(refreshDelayMs(0)).toBe(MINIMUM_DELAY_MS);
    expect(refreshDelayMs(-1)).toBe(MINIMUM_DELAY_MS);
  });

  it("treats a token inside the safety margin as stale so waking renews it", () => {
    const now = 1_000_000;

    expect(isTokenStale(expiresAtMs(15 * 60, now), now)).toBe(false);
    expect(isTokenStale(expiresAtMs(119, now), now)).toBe(true);
    expect(isTokenStale(expiresAtMs(0, now), now)).toBe(true);
  });
});
