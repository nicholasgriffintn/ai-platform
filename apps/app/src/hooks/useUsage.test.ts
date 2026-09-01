import { describe, expect, it } from "vitest";

import { getUsageBalanceRefreshInterval } from "./useUsage";

describe("getUsageBalanceRefreshInterval", () => {
  it("refreshes an expired usage period promptly", () => {
    expect(
      getUsageBalanceRefreshInterval(
        "2026-09-01T00:00:00.000Z",
        new Date("2026-09-01T12:00:00.000Z").getTime(),
      ),
    ).toBe(60_000);
  });

  it("refreshes at the reset boundary without scheduling an unsafe long timer", () => {
    expect(
      getUsageBalanceRefreshInterval(
        "2026-09-02T00:00:00.000Z",
        new Date("2026-09-01T12:00:00.000Z").getTime(),
      ),
    ).toBe(12 * 60 * 60 * 1_000 + 1_000);

    expect(
      getUsageBalanceRefreshInterval(
        "2026-10-01T00:00:00.000Z",
        new Date("2026-09-01T12:00:00.000Z").getTime(),
      ),
    ).toBe(24 * 60 * 60 * 1_000);
  });
});
