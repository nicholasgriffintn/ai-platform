import { describe, expect, it } from "vitest";

import {
  buildExhaustedProviderQuota,
  hasProviderQuotaRecovered,
  isProviderQuotaBlocked,
} from "../provider-quota";

const now = new Date("2026-10-25T12:00:00.000Z");
const minutesLater = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

describe("provider quota", () => {
  it("blocks a provider with a known reset until the reset or a top-up", () => {
    const quota = buildExhaustedProviderQuota(
      { remaining: 92, resetsAt: "2026-11-01T00:00:00.000Z" },
      now,
    );

    expect(isProviderQuotaBlocked(quota, minutesLater(60 * 24))).toBe(true);
    expect(isProviderQuotaBlocked(quota, new Date("2026-11-01T00:00:01.000Z"))).toBe(false);
    expect(hasProviderQuotaRecovered(quota, { remaining: 40, resetsAt: null }, now)).toBe(false);
    expect(hasProviderQuotaRecovered(quota, { remaining: 5000, resetsAt: null }, now)).toBe(true);
  });

  it("keeps a prepaid provider blocked until its balance grows", () => {
    const quota = buildExhaustedProviderQuota({ remaining: 0, resetsAt: null }, now);

    expect(isProviderQuotaBlocked(quota, minutesLater(60 * 24 * 30))).toBe(true);
    expect(hasProviderQuotaRecovered(quota, { remaining: 0, resetsAt: null }, now)).toBe(false);
    expect(hasProviderQuotaRecovered(quota, { remaining: 10, resetsAt: null }, now)).toBe(true);
    expect(hasProviderQuotaRecovered(quota, null, now)).toBe(true);
  });

  it("lets the next request retry a key that cannot read its balance after 15 minutes", () => {
    const quota = buildExhaustedProviderQuota(null, now);

    expect(isProviderQuotaBlocked(quota, minutesLater(14))).toBe(true);
    expect(hasProviderQuotaRecovered(quota, null, minutesLater(14))).toBe(false);
    expect(isProviderQuotaBlocked(quota, minutesLater(15))).toBe(false);
  });
});
