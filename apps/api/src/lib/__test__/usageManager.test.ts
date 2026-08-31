import { describe, expect, it, vi } from "vitest";

import { USAGE_CONFIG } from "~/constants/app";
import type { AnonymousUser, User } from "~/types";
import { ErrorType } from "~/utils/errors";

import { UsageManager } from "../usageManager";

function user(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    plan_id: "free",
    daily_message_count: 0,
    daily_reset: new Date().toISOString(),
    ...overrides,
  } as User;
}

function anonymousUser(overrides: Partial<AnonymousUser> = {}): AnonymousUser {
  return {
    id: "anonymous-1",
    ip_address: "127.0.0.1",
    daily_message_count: 0,
    daily_reset: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function repositories(
  options: {
    anonymousCount?: number;
    balance?: Record<string, number> | null;
    includedCredits?: number;
    graceCredits?: number;
  } = {},
) {
  const incrementUsageCounters = vi.fn(
    async (_userId: number, increments: Record<string, number>) => user(increments),
  );
  const incrementDailyCount = vi.fn(async () => undefined);

  return {
    incrementUsageCounters,
    incrementDailyCount,
    value: {
      users: {
        incrementUsageCounters,
        getUserById: vi.fn(async () => ({ plan_id: "pro" })),
      },
      anonymousUsers: {
        checkAndResetDailyLimit: vi.fn(async () => ({ count: options.anonymousCount ?? 0 })),
        incrementDailyCount,
      },
      usageBalances: {
        getBalance: vi.fn(async () => options.balance ?? null),
      },
      plans: {
        getPlanById: vi.fn(async () => ({
          included_credits: options.includedCredits ?? 0,
          grace_credits: options.graceCredits ?? 0,
        })),
      },
    },
  };
}

describe("UsageManager", () => {
  it("keeps the daily message guard for free accounts", async () => {
    const repo = repositories();
    const manager = new UsageManager(
      repo.value as never,
      user({ daily_message_count: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT }),
      null,
    );

    await expect(manager.checkUsage()).rejects.toMatchObject({
      type: ErrorType.USAGE_LIMIT_ERROR,
    });
  });

  it("does not apply the message guard to paid accounts", async () => {
    const repo = repositories();
    const manager = new UsageManager(
      repo.value as never,
      user({ plan_id: "enterprise", daily_message_count: 1_000_000 }),
      null,
    );

    await expect(manager.checkUsage()).resolves.toEqual({ dailyCount: 0, dailyLimit: null });
  });

  it("records one free-account response without cutting off later model steps", async () => {
    const repo = repositories();
    const manager = new UsageManager(repo.value as never, user(), null);

    await manager.checkUsage();
    await manager.incrementUsage();
    await manager.incrementUsage();

    expect(repo.incrementUsageCounters).toHaveBeenCalledOnce();
    expect(repo.incrementUsageCounters).toHaveBeenCalledWith(7, {
      message_count: 1,
      daily_message_count: 1,
    });
    await expect(manager.getUsageLimits()).resolves.toMatchObject({
      daily: { used: 1, limit: USAGE_CONFIG.AUTH_DAILY_MESSAGE_LIMIT },
    });
  });

  it("keeps cumulative activity but removes paid and BYOK counters", async () => {
    const repo = repositories();
    const manager = new UsageManager(repo.value as never, user({ plan_id: "pro" }), null);

    await manager.incrementUsage();

    expect(repo.incrementUsageCounters).toHaveBeenCalledWith(7, { message_count: 1 });
  });

  it("keeps the anonymous daily guard", async () => {
    const repo = repositories({ anonymousCount: USAGE_CONFIG.NON_AUTH_DAILY_MESSAGE_LIMIT });
    const manager = new UsageManager(repo.value as never, null, anonymousUser());

    await expect(manager.checkUsage()).rejects.toMatchObject({
      type: ErrorType.USAGE_LIMIT_ERROR,
    });
  });

  it("publishes ledger credits with the compatibility usage event", async () => {
    const repo = repositories({
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

    await expect(manager.getUsageLimits()).resolves.toEqual({
      daily: { used: 0, limit: null },
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
      daily: { used: 0, limit: null },
      credits: {
        included: 500,
        grace: 50,
        used: 0,
        state: "ok",
      },
    });
  });
});
