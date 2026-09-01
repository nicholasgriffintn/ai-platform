import { describe, expect, it, vi } from "vitest";

import { resolveRealtimeMaxSessionSeconds } from "~/lib/realtime/sessionLimits";

import { admitRealtimeSession } from "../sessionUsage";

function repositoriesWithBalance(balance: Record<string, unknown> | null) {
  return {
    usageBalances: { getBalance: vi.fn(async () => balance) },
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
  it("admits freely while the plan is unconfigured", async () => {
    const repositories = repositoriesWithBalance(balance({ included_credit_micros: 0 }));

    await expect(
      admitRealtimeSession({ repositories, userId: 7, creditMicros: 50_000_000 }),
    ).resolves.toBe(true);
  });

  it("admits when no balance row exists yet", async () => {
    const repositories = repositoriesWithBalance(null);

    await expect(
      admitRealtimeSession({ repositories, userId: 7, creditMicros: 50_000_000 }),
    ).resolves.toBe(true);
  });

  it("refuses a session the configured allowance cannot fit", async () => {
    const repositories = repositoriesWithBalance(
      balance({ spent_credit_micros: 1_050_000, reserved_credit_micros: 40_000 }),
    );

    await expect(
      admitRealtimeSession({ repositories, userId: 7, creditMicros: 50_000 }),
    ).resolves.toBe(false);
  });

  it("admits a session that still fits inside included plus grace", async () => {
    const repositories = repositoriesWithBalance(balance({ spent_credit_micros: 900_000 }));

    await expect(
      admitRealtimeSession({ repositories, userId: 7, creditMicros: 50_000 }),
    ).resolves.toBe(true);
  });

  it("admits past the ceiling when overage is enabled", async () => {
    const repositories = repositoriesWithBalance(
      balance({ spent_credit_micros: 5_000_000, overage_enabled: 1 }),
    );

    await expect(
      admitRealtimeSession({ repositories, userId: 7, creditMicros: 50_000 }),
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
      admitRealtimeSession({ repositories, userId: 7, creditMicros: 50_000 }),
    ).resolves.toBe(true);
  });
});

describe("resolveRealtimeMaxSessionSeconds", () => {
  it("defaults when unset and clamps to the supported range", () => {
    expect(resolveRealtimeMaxSessionSeconds({})).toBe(1800);
    expect(resolveRealtimeMaxSessionSeconds({ REALTIME_MAX_SESSION_SECONDS: "10" })).toBe(60);
    expect(resolveRealtimeMaxSessionSeconds({ REALTIME_MAX_SESSION_SECONDS: "99999" })).toBe(3600);
    expect(resolveRealtimeMaxSessionSeconds({ REALTIME_MAX_SESSION_SECONDS: "600" })).toBe(600);
    expect(resolveRealtimeMaxSessionSeconds({ REALTIME_MAX_SESSION_SECONDS: "nonsense" })).toBe(
      1800,
    );
  });
});
