import { describe, expect, it, vi } from "vitest";

import type { AnonymousUser, User } from "~/types";

import { UsageManager } from "../usageManager";

function user(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    plan_id: "free",
    ...overrides,
  } as User;
}

function anonymousUser(overrides: Partial<AnonymousUser> = {}): AnonymousUser {
  return {
    id: "anonymous-1",
    ip_address: "127.0.0.1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function repositories(
  options: {
    anonymousSpentCreditMicros?: number;
    balance?: Record<string, number> | null;
    includedCredits?: number;
    graceCredits?: number;
    plan?: Record<string, unknown> | null;
  } = {},
) {
  const incrementUsageCounters = vi.fn(
    async (_userId: number, increments: Record<string, number>) => user(increments),
  );

  return {
    incrementUsageCounters,
    value: {
      users: {
        incrementUsageCounters,
        getUserById: vi.fn(async () => ({ plan_id: "pro" })),
      },
      anonymousUsers: {
        getCreditSpend: vi.fn(async () => ({
          spentCreditMicros: options.anonymousSpentCreditMicros ?? 0,
          reservedCreditMicros: 0,
        })),
      },
      usageBalances: {
        getBalance: vi.fn(async () => options.balance ?? null),
      },
      plans: {
        getPlanById: vi.fn(async () =>
          options.plan === undefined
            ? {
                included_credits: options.includedCredits ?? 0,
                grace_credits: options.graceCredits ?? 0,
              }
            : options.plan,
        ),
      },
    },
  };
}

describe("UsageManager", () => {
  it("records one response per turn without cutting off later model steps", async () => {
    const repo = repositories();
    const manager = new UsageManager(repo.value as never, user(), null);

    await manager.incrementUsage();
    await manager.incrementUsage();

    expect(repo.incrementUsageCounters).toHaveBeenCalledOnce();
    expect(repo.incrementUsageCounters).toHaveBeenCalledWith(7, { message_count: 1 });
  });

  it("publishes ledger credits for a signed-in account", async () => {
    const repo = repositories({
      includedCredits: 10,
      graceCredits: 1,
      balance: {
        included_credit_micros: 10_000_000,
        grace_credit_micros: 1_000_000,
        spent_credit_micros: 2_500_000,
        reserved_credit_micros: 500_000,
        overrun_credit_micros: 0,
        overage_credit_micros: 0,
        overage_enabled: 0,
      },
    });
    const manager = new UsageManager(repo.value as never, user({ plan_id: "pro" }), null);

    await expect(manager.getUsageLimits()).resolves.toMatchObject({
      credits: {
        included: 10,
        used: 2.5,
        reserved: 0.5,
        grace: 1,
        overrun: 0,
        overage: 0,
        overage_enabled: false,
        state: "ok",
      },
    });
  });

  it("shows configured plan credits before the first ledger event", async () => {
    const repo = repositories({ includedCredits: 500, graceCredits: 50 });
    const manager = new UsageManager(repo.value as never, user({ plan_id: "pro" }), null);

    await expect(manager.getUsageLimits()).resolves.toMatchObject({
      credits: {
        included: 500,
        grace: 50,
        used: 0,
        state: "ok",
      },
    });
  });

  it("gives an anonymous visitor the allowance on the anonymous plan row", async () => {
    const repo = repositories({ includedCredits: 20, graceCredits: 0 });
    const manager = new UsageManager(repo.value as never, null, anonymousUser());

    await expect(manager.getUsageLimits()).resolves.toMatchObject({
      credits: { included: 20, used: 0, state: "ok" },
    });
  });

  it("reports an anonymous visitor past its allowance and reserve as exhausted", async () => {
    const repo = repositories({
      includedCredits: 20,
      graceCredits: 0,
      anonymousSpentCreditMicros: 30_000_000,
    });
    const manager = new UsageManager(repo.value as never, null, anonymousUser());

    await expect(manager.getUsageLimits()).resolves.toMatchObject({
      credits: { state: "exhausted" },
    });
  });
});
