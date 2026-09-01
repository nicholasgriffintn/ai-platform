import { describe, expect, it } from "vitest";

import { getSidebarUsageItems } from "../sidebar-usage";

describe("getSidebarUsageItems", () => {
  it("uses the authoritative balance when auth only knows that usage is unbounded", () => {
    const [credits] = getSidebarUsageItems(
      { daily: { used: 0, limit: null } },
      {
        included: 0,
        used: 0.1706,
        reserved: 0,
        grace: 0,
        overrun: 0.1706,
        overage: 0,
        overage_enabled: false,
        state: "exhausted",
      },
    );

    expect(credits).toMatchObject({
      id: "credits",
      value: "0.1706 used",
    });
  });

  it("presents credits as usage-only when no allowance is configured", () => {
    const [credits] = getSidebarUsageItems({
      daily: { used: 0, limit: null },
      credits: {
        included: 0,
        used: 0.1706,
        reserved: 0,
        grace: 0,
        overrun: 0.1706,
        overage: 0,
        overage_enabled: false,
        state: "exhausted",
      },
    });

    expect(credits).toMatchObject({
      value: "0.1706 used",
      assistiveLabel: "0.1706 credits used this month",
      percentage: null,
    });
  });
});
