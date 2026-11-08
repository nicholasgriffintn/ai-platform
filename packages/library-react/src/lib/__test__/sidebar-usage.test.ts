import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getSidebarUsageItems } from "../sidebar-usage.js";

function credits(overrides: Partial<UsageCreditsSummary> = {}): UsageCreditsSummary {
  return {
    included: 1000,
    used: 250,
    reserved: 0,
    grace: 100,
    overrun: 0,
    overage: 0,
    overage_enabled: false,
    state: "ok",
    ...overrides,
  };
}

describe("getSidebarUsageItems", () => {
  it("prefers the authoritative balance over the streamed snapshot", () => {
    const [item] = getSidebarUsageItems({ credits: credits({ used: 10 }) }, credits({ used: 400 }));

    expect(item).toMatchObject({ id: "credits", value: "400 / 1,000" });
  });

  it("presents credits as usage-only when no allowance is configured", () => {
    const [item] = getSidebarUsageItems(null, credits({ included: 0, grace: 0, used: 0.1706 }));

    expect(item).toMatchObject({
      value: "0.17 used",
      assistiveLabel: "0.17 credits used this month",
      percentage: null,
    });
  });

  it("caps the bar when spend passes the reserve", () => {
    const [item] = getSidebarUsageItems({ credits: credits({ used: 1300, state: "exhausted" }) });

    expect(item.percentage).toBe(100);
  });
});
