import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getSidebarUsageItems } from "../sidebar-usage";

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
  it("returns nothing without a credit balance", () => {
    expect(getSidebarUsageItems(null)).toEqual([]);
    expect(getSidebarUsageItems({} as never)).toEqual([]);
  });

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

  it("hides the reserve segment while the state is ok", () => {
    const [item] = getSidebarUsageItems({ credits: credits() });

    expect(item.reserveStartPercentage).toBeUndefined();
    expect(item.percentage).toBe(25);
  });

  it("shows the reserve segment once the reserve is entered", () => {
    const [item] = getSidebarUsageItems({ credits: credits({ used: 1050, state: "reserve" }) });

    expect(item.reserveStartPercentage).toBeCloseTo((1000 / 1100) * 100);
    expect(item.percentage).toBeCloseTo((1050 / 1100) * 100);
  });

  it("caps the bar when spend passes the reserve", () => {
    const [item] = getSidebarUsageItems({ credits: credits({ used: 1300, state: "exhausted" }) });

    expect(item.percentage).toBe(100);
  });
});
