import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import {
  computeOverageSyncDelta,
  runStripeOverageSync,
} from "~/modules/subscription/application/stripeOverageSync";
import type { OverageSyncCandidateRow } from "~/modules/usage/infrastructure/UsageBalanceRepository";
import { UsageBalanceRepository } from "~/modules/usage/infrastructure/UsageBalanceRepository";

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
    repositories: fakeRepositories([[UsageBalanceRepository, usageBalances]]),
    usageBalances,
  };
}

function makeStripe(create = vi.fn(async () => ({}))) {
  return { stripe: { billing: { meterEvents: { create } } }, create };
}

describe("computeOverageSyncDelta", () => {
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

describe("runStripeOverageSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
