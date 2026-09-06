import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildUsageBanner } from "./usage-banner";

function credits(overrides: Partial<UsageCreditsSummary> = {}): UsageCreditsSummary {
  return {
    included: 1000,
    used: 100,
    reserved: 0,
    grace: 100,
    overrun: 0,
    overage: 0,
    overage_enabled: false,
    state: "ok",
    ...overrides,
  };
}

describe("buildUsageBanner", () => {
  it("stays quiet without a balance or while the state is ok", () => {
    expect(buildUsageBanner(null)).toBeNull();
    expect(buildUsageBanner({ credits: credits() })).toBeNull();
  });

  it("shows a dismissible session heads-up in reserve", () => {
    const banner = buildUsageBanner({ credits: credits({ used: 1020, state: "reserve" }) });

    expect(banner?.id).toBe("credits-reserve");
    expect(banner?.tone).toBe("info");
    expect(banner?.dismissal).toEqual({ scope: "session" });
  });

  it("stays quiet in overage because the person opted in", () => {
    expect(
      buildUsageBanner({
        credits: credits({ used: 1200, overage_enabled: true, state: "overage" }),
      }),
    ).toBeNull();
  });

  it("shows an undismissable banner with a billing link when exhausted", () => {
    const banner = buildUsageBanner({ credits: credits({ used: 1200, state: "exhausted" }) });

    expect(banner?.id).toBe("credits-exhausted");
    expect(banner?.tone).toBe("critical");
    expect(banner?.dismissal).toBeUndefined();
    expect(banner?.action?.to).toBe("/profile?tab=billing");
  });
});
