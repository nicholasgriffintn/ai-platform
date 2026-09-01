import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepositoryManager } from "~/repositories";
import type { OverageSyncCandidateRow } from "~/repositories/UsageBalanceRepository";

import {
  computeOverageSyncDelta,
  overageMeterEventIdentifier,
  overageSyncHourIso,
  runStripeOverageSync,
} from "../stripeOverageSync";

const MICRO = 1_000_000;

function candidate(overrides: Partial<OverageSyncCandidateRow> = {}): OverageSyncCandidateRow {
  return {
    user_id: 1,
    period: "2026-09",
    overage_credit_micros: 0,
    stripe_synced_overage_credit_micros: 0,
    stripe_customer_id: "cus_1",
    stripe_meter_id: "polychat_overage_credits",
    ...overrides,
  };
}

function makeRepositories(candidates: OverageSyncCandidateRow[]) {
  const usageBalances = {
    listOverageSyncCandidates: vi.fn(async () => candidates),
    recordStripeSyncedOverage: vi.fn(async () => {}),
  };

  return {
    repositories: { usageBalances } as unknown as RepositoryManager,
    usageBalances,
  };
}

function makeStripe(create = vi.fn(async () => ({}))) {
  return { stripe: { billing: { meterEvents: { create } } }, create };
}

describe("computeOverageSyncDelta", () => {
  it("rounds down to whole credits and keeps the remainder pending", () => {
    expect(computeOverageSyncDelta(2_700_000, 0)).toEqual({
      wholeCredits: 2,
      syncedMicros: 2_000_000,
    });
  });

  it("sends nothing while the pending amount is below one credit", () => {
    expect(computeOverageSyncDelta(900_000, 0)).toEqual({ wholeCredits: 0, syncedMicros: 0 });
    expect(computeOverageSyncDelta(2_900_000, 2_000_000)).toEqual({
      wholeCredits: 0,
      syncedMicros: 0,
    });
  });

  it("never produces a negative delta when the mark is ahead", () => {
    expect(computeOverageSyncDelta(1_000_000, 2_000_000)).toEqual({
      wholeCredits: 0,
      syncedMicros: 0,
    });
  });

  it("carries the remainder so consecutive syncs neither lose nor double-send", () => {
    let overage = 0;
    let synced = 0;
    let totalSentCredits = 0;
    const accruals = [2_700_000, 1_000_000, 400_000, 950_000, 5_050_000];

    for (const accrued of accruals) {
      overage += accrued;
      const delta = computeOverageSyncDelta(overage, synced);

      synced += delta.syncedMicros;
      totalSentCredits += delta.wholeCredits;
    }

    const totalAccrued = accruals.reduce((sum, value) => sum + value, 0);

    expect(totalSentCredits).toBe(Math.floor(totalAccrued / MICRO));
    expect(overage - synced).toBe(totalAccrued % MICRO);
  });
});

describe("overage meter event identity", () => {
  it("truncates the sync time to the hour", () => {
    expect(overageSyncHourIso(new Date("2026-09-01T14:37:22.123Z"))).toBe("2026-09-01T14:00:00Z");
  });

  it("builds one identifier per customer per hour", () => {
    expect(overageMeterEventIdentifier("cus_1", "2026-09-01T14:00:00Z")).toBe(
      "cus_1:2026-09-01T14:00:00Z",
    );
  });
});

describe("runStripeOverageSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends one meter event per customer and marks the sent amount as synced", async () => {
    const rows = [
      candidate({ user_id: 1, stripe_customer_id: "cus_1", overage_credit_micros: 2_700_000 }),
      candidate({
        user_id: 2,
        stripe_customer_id: "cus_2",
        overage_credit_micros: 5_400_000,
        stripe_synced_overage_credit_micros: 1_000_000,
      }),
    ];
    const { repositories, usageBalances } = makeRepositories(rows);
    const { stripe, create } = makeStripe();

    const result = await runStripeOverageSync(
      repositories,
      stripe,
      new Date("2026-09-01T14:00:00Z"),
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, {
      event_name: "polychat_overage_credits",
      identifier: "cus_1:2026-09-01T14:00:00Z",
      timestamp: Date.parse("2026-09-01T14:00:00Z") / 1000,
      payload: { stripe_customer_id: "cus_1", value: "2" },
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      event_name: "polychat_overage_credits",
      identifier: "cus_2:2026-09-01T14:00:00Z",
      timestamp: Date.parse("2026-09-01T14:00:00Z") / 1000,
      payload: { stripe_customer_id: "cus_2", value: "4" },
    });
    expect(usageBalances.recordStripeSyncedOverage).toHaveBeenNthCalledWith(
      1,
      1,
      "2026-09",
      2_000_000,
    );
    expect(usageBalances.recordStripeSyncedOverage).toHaveBeenNthCalledWith(
      2,
      2,
      "2026-09",
      4_000_000,
    );
    expect(result).toMatchObject({ candidates: 2, sent: 2, failed: 0 });
  });

  it("skips a plan without a meter and a balance below one whole credit", async () => {
    const rows = [
      candidate({ user_id: 1, stripe_meter_id: null, overage_credit_micros: 9_000_000 }),
      candidate({ user_id: 2, overage_credit_micros: 900_000 }),
    ];
    const { repositories, usageBalances } = makeRepositories(rows);
    const { stripe, create } = makeStripe();

    const result = await runStripeOverageSync(repositories, stripe, new Date());

    expect(create).not.toHaveBeenCalled();
    expect(usageBalances.recordStripeSyncedOverage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skippedNoMeter: 1, skippedBelowOneCredit: 1, sent: 0 });
  });

  it("marks the amount as synced when the hour's identifier already exists", async () => {
    const rows = [candidate({ overage_credit_micros: 3_000_000 })];
    const { repositories, usageBalances } = makeRepositories(rows);
    const { stripe } = makeStripe(
      vi.fn(async () => {
        throw new Error("A meter event with this identifier already exists.");
      }),
    );

    const result = await runStripeOverageSync(repositories, stripe, new Date());

    expect(usageBalances.recordStripeSyncedOverage).toHaveBeenCalledWith(1, "2026-09", 3_000_000);
    expect(result).toMatchObject({ markedAfterDuplicate: 1, sent: 0, failed: 0 });
  });

  it("leaves the amount pending on other failures and continues with the next customer", async () => {
    const rows = [
      candidate({ user_id: 1, stripe_customer_id: "cus_1", overage_credit_micros: 2_000_000 }),
      candidate({ user_id: 2, stripe_customer_id: "cus_2", overage_credit_micros: 6_000_000 }),
    ];
    const { repositories, usageBalances } = makeRepositories(rows);
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("Stripe is unavailable"))
      .mockResolvedValueOnce({});
    const { stripe } = makeStripe(create);

    const result = await runStripeOverageSync(repositories, stripe, new Date());

    expect(create).toHaveBeenCalledTimes(2);
    expect(usageBalances.recordStripeSyncedOverage).toHaveBeenCalledTimes(1);
    expect(usageBalances.recordStripeSyncedOverage).toHaveBeenCalledWith(2, "2026-09", 6_000_000);
    expect(result).toMatchObject({ sent: 1, failed: 1 });
  });
});
