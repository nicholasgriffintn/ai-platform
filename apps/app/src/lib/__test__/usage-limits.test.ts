import { describe, expect, it } from "vitest";

import { getUsageLimitsFromUser, normaliseUsageLimits } from "../usage-limits";

describe("usage limit contract", () => {
  it("preserves the monthly credit snapshot from the stream", () => {
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

    expect(
      normaliseUsageLimits({
        daily: { used: 0, limit: null },
        credits,
      }),
    ).toEqual({ daily: { used: 0, limit: null }, credits });
  });

  it("keeps the daily abuse guard on Free accounts only", () => {
    expect(getUsageLimitsFromUser({ plan_id: "free", daily_message_count: 12 } as never)).toEqual({
      daily: { used: 12, limit: 50 },
    });
    expect(getUsageLimitsFromUser({ plan_id: "pro", daily_message_count: 12 } as never)).toEqual({
      daily: { used: 0, limit: null },
    });
  });
});
