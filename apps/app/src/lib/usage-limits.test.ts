import { describe, expect, it } from "vitest";

import { isCreditsConfigured, normaliseUsageLimits } from "./usage-limits";

const credits = {
  included: 1000,
  used: 250,
  reserved: 0,
  grace: 100,
  overrun: 0,
  overage: 0,
  overage_enabled: false,
  state: "ok",
};

describe("normaliseUsageLimits", () => {
  it("carries a valid credits summary through", () => {
    const result = normaliseUsageLimits({ daily: { used: 3, limit: 50 }, credits });

    expect(result?.credits).toEqual(credits);
  });

  it("drops a malformed credits object without losing the daily limits", () => {
    const result = normaliseUsageLimits({
      daily: { used: 3, limit: 50 },
      credits: { included: "many", state: "ok" },
    });

    expect(result).not.toBeNull();
    expect(result?.daily).toEqual({ used: 3, limit: 50 });
    expect(result?.credits).toBeUndefined();
  });

  it("drops a credits object with an unknown state", () => {
    const result = normaliseUsageLimits({
      daily: { used: 3, limit: 50 },
      credits: { ...credits, state: "panic" },
    });

    expect(result?.credits).toBeUndefined();
  });
});

describe("isCreditsConfigured", () => {
  it("treats a positive included balance as configured", () => {
    expect(isCreditsConfigured({ ...credits, state: "ok" as const })).toBe(true);
  });

  it("treats zero included credits as unconfigured", () => {
    expect(isCreditsConfigured({ ...credits, state: "ok" as const, included: 0 })).toBe(false);
  });

  it("treats missing credits as unconfigured", () => {
    expect(isCreditsConfigured(undefined)).toBe(false);
    expect(isCreditsConfigured(null)).toBe(false);
  });
});
