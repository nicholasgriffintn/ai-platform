import { describe, expect, it } from "vitest";

import { normaliseUsageLimits } from "../usage-limits";

const credits = {
  included: 500,
  used: 125,
  reserved: 25,
  grace: 50,
  overrun: 0,
  overage: 0,
  overage_enabled: false,
  state: "ok" as const,
};

describe("normaliseUsageLimits", () => {
  it("preserves the monthly credit snapshot from the stream", () => {
    expect(normaliseUsageLimits({ credits })).toEqual({ credits });
  });

  it("rejects a malformed credits object rather than half-applying it", () => {
    expect(normaliseUsageLimits({ credits: { included: "many", state: "ok" } })).toBeNull();
    expect(normaliseUsageLimits({ credits: { ...credits, state: "panic" } })).toBeNull();
    expect(normaliseUsageLimits({})).toBeNull();
  });
});
