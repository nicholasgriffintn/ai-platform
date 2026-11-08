import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { UsageBalanceRepository } from "~/modules/usage/infrastructure/UsageBalanceRepository";

import { admitRealtimeSession } from "../sessionUsage";

function repositoriesWithBalance(balanceRow: Record<string, unknown> | null) {
  return {
    usageBalances: { getBalance: vi.fn(async () => balanceRow) },
  } as any;
}

function balance(overrides: Record<string, unknown> = {}) {
  return {
    included_credit_micros: 1_000_000,
    grace_credit_micros: 100_000,
    spent_credit_micros: 0,
    reserved_credit_micros: 0,
    overage_enabled: 0,
    ...overrides,
  };
}

describe("admitRealtimeSession", () => {
  it("refuses a session the configured allowance cannot fit", async () => {
    const repositories = repositoriesWithBalance(
      balance({ spent_credit_micros: 1_050_000, reserved_credit_micros: 40_000 }),
    );

    await expect(
      admitRealtimeSession({
        repositories: fakeRepositories([[UsageBalanceRepository, repositories.usageBalances]]),
        userId: 7,
        creditMicros: 50_000,
      }),
    ).resolves.toBe(false);
  });

  it("admits past the ceiling when overage is enabled", async () => {
    const repositories = repositoriesWithBalance(
      balance({ spent_credit_micros: 5_000_000, overage_enabled: 1 }),
    );

    await expect(
      admitRealtimeSession({
        repositories: fakeRepositories([[UsageBalanceRepository, repositories.usageBalances]]),
        userId: 7,
        creditMicros: 50_000,
      }),
    ).resolves.toBe(true);
  });

  it("admits when the balance lookup fails rather than blocking the user", async () => {
    const repositories = {
      usageBalances: {
        getBalance: vi.fn(async () => {
          throw new Error("D1 unavailable");
        }),
      },
    } as any;

    await expect(
      admitRealtimeSession({
        repositories: fakeRepositories([[UsageBalanceRepository, repositories.usageBalances]]),
        userId: 7,
        creditMicros: 50_000,
      }),
    ).resolves.toBe(true);
  });
});
