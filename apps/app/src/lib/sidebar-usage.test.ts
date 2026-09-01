import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getSidebarUsageItems } from "./sidebar-usage";

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
  it("returns nothing without limits", () => {
    expect(getSidebarUsageItems(null)).toEqual([]);
  });

  it("keeps the legacy bars when credits are not configured", () => {
    const items = getSidebarUsageItems({
      daily: { used: 3, limit: 50 },
      pro: { used: 10, limit: 200 },
      byok: { used: 2, limit: null },
    });

    expect(items.map((item) => item.id)).toEqual(["standard", "pro", "byok"]);
  });

  it("keeps the legacy bars when credits report zero included", () => {
    const items = getSidebarUsageItems({
      daily: { used: 3, limit: 50 },
      credits: credits({ included: 0 }),
    });

    expect(items.map((item) => item.id)).toEqual(["standard"]);
  });

  it("makes credits the primary bar when configured", () => {
    const items = getSidebarUsageItems({
      daily: { used: 3, limit: 50 },
      pro: { used: 10, limit: 200 },
      byok: { used: 2, limit: null },
      credits: credits(),
    });

    expect(items.map((item) => item.id)).toEqual(["credits", "byok"]);
    expect(items[0].tone).toBe("violet");
  });

  it("hides the reserve segment while the state is ok", () => {
    const [item] = getSidebarUsageItems({
      daily: { used: 3, limit: 50 },
      credits: credits(),
    });

    expect(item.reserveStartPercentage).toBeUndefined();
    expect(item.percentage).toBe(25);
  });

  it("shows the reserve segment once the reserve is entered", () => {
    const [item] = getSidebarUsageItems({
      daily: { used: 3, limit: 50 },
      credits: credits({ used: 1050, state: "reserve" }),
    });

    expect(item.reserveStartPercentage).toBeCloseTo((1000 / 1100) * 100);
    expect(item.percentage).toBeCloseTo((1050 / 1100) * 100);
  });

  it("caps the bar when spend passes the reserve", () => {
    const [item] = getSidebarUsageItems({
      daily: { used: 3, limit: 50 },
      credits: credits({ used: 1300, state: "exhausted" }),
    });

    expect(item.percentage).toBe(100);
  });
});
