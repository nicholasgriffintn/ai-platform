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

const daily = { used: 0, limit: 50 };

describe("buildUsageBanner with configured credits", () => {
  it("stays quiet while the state is ok", () => {
    expect(buildUsageBanner({ daily, credits: credits() }, true)).toBeNull();
  });

  it("shows a dismissible session heads-up in reserve", () => {
    const banner = buildUsageBanner(
      { daily, credits: credits({ used: 1020, state: "reserve" }) },
      true,
    );

    expect(banner?.id).toBe("credits-reserve");
    expect(banner?.tone).toBe("info");
    expect(banner?.dismissal).toEqual({ scope: "session" });
  });

  it("stays quiet in overage because the person opted in", () => {
    expect(
      buildUsageBanner(
        { daily, credits: credits({ used: 1200, overage_enabled: true, state: "overage" }) },
        true,
      ),
    ).toBeNull();
  });

  it("shows an undismissable banner with a billing link when exhausted", () => {
    const banner = buildUsageBanner(
      { daily, credits: credits({ used: 1200, state: "exhausted" }) },
      true,
    );

    expect(banner?.id).toBe("credits-exhausted");
    expect(banner?.tone).toBe("critical");
    expect(banner?.dismissal).toBeUndefined();
    expect(banner?.action?.to).toBe("/profile?tab=billing");
  });

  it("suppresses the legacy daily banners for credit accounts", () => {
    const banner = buildUsageBanner({ daily: { used: 50, limit: 50 }, credits: credits() }, false);

    expect(banner).toBeNull();
  });
});

describe("buildUsageBanner without configured credits", () => {
  it("keeps the legacy daily exhausted banner", () => {
    const banner = buildUsageBanner({ daily: { used: 50, limit: 50 } }, false);

    expect(banner?.id).toBe("usage-daily-exhausted");
    expect(banner?.tone).toBe("critical");
  });

  it("keeps the legacy daily exhausted banner when credits report zero included", () => {
    const banner = buildUsageBanner(
      { daily: { used: 50, limit: 50 }, credits: credits({ included: 0 }) },
      false,
    );

    expect(banner?.id).toBe("usage-daily-exhausted");
  });

  it("warns when the pro lane runs low", () => {
    const banner = buildUsageBanner(
      { daily: { used: 1, limit: 50 }, pro: { used: 170, limit: 200 } },
      true,
    );

    expect(banner?.id).toBe("usage-pro-low");
    expect(banner?.dismissal).toEqual({ scope: "day" });
  });
});
