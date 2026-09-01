import { describe, expect, it, vi } from "vitest";

import { isUsageExhausted, readUsageLimitState, shouldStopTurnForUsage } from "../limitState";

function manager(limits: unknown) {
  return { getUsageLimits: vi.fn(async () => limits) } as any;
}

describe("readUsageLimitState", () => {
  it("reports a user who has spent their daily allowance as exhausted", async () => {
    await expect(
      readUsageLimitState(manager({ daily: { used: 100, limit: 100 } })),
    ).resolves.toEqual({ exhausted: true, used: 100, limit: 100 });
  });

  it("reports a user with allowance left as not exhausted", async () => {
    await expect(
      readUsageLimitState(manager({ daily: { used: 99, limit: 100 } })),
    ).resolves.toEqual({ exhausted: false, used: 99, limit: 100 });
  });

  it("prefers the pro allowance when the account has one", async () => {
    await expect(
      readUsageLimitState(
        manager({ daily: { used: 0, limit: 1000 }, pro: { used: 50, limit: 50 } }),
      ),
    ).resolves.toMatchObject({ exhausted: true, limit: 50 });
  });

  it("treats an unreadable limit as not exhausted so a storage blip cannot lock a user out", async () => {
    const failing = {
      getUsageLimits: vi.fn(async () => {
        throw new Error("d1 unavailable");
      }),
    } as any;

    await expect(isUsageExhausted(failing)).resolves.toBe(false);
    await expect(isUsageExhausted(manager(null))).resolves.toBe(false);
    await expect(isUsageExhausted(manager({ daily: { used: 5, limit: null } }))).resolves.toBe(
      false,
    );
  });

  it("counts an overspent allowance as exhausted", async () => {
    await expect(isUsageExhausted(manager({ daily: { used: 140, limit: 100 } }))).resolves.toBe(
      true,
    );
  });
});

function credits(overrides: Record<string, unknown> = {}) {
  return {
    included: 100,
    used: 0,
    reserved: 0,
    grace: 20,
    overrun: 0,
    overage: 0,
    overage_enabled: false,
    state: "ok",
    ...overrides,
  };
}

describe("credit-aware limit state", () => {
  it("lets message counts stop governing once credits are configured", async () => {
    const state = await readUsageLimitState(
      manager({
        daily: { used: 100, limit: 100 },
        credits: credits({ used: 110, state: "reserve" }),
      }),
    );

    expect(state.exhausted).toBe(false);
    expect(state.credits).toMatchObject({ state: "reserve" });
  });

  it("reports exhausted only once the credit state says so", async () => {
    await expect(
      isUsageExhausted(
        manager({
          daily: { used: 0, limit: 100 },
          credits: credits({ used: 125, state: "exhausted" }),
        }),
      ),
    ).resolves.toBe(true);
  });
});

describe("shouldStopTurnForUsage", () => {
  it("keeps an admitted turn alive through reserve and exhaustion", async () => {
    await expect(
      shouldStopTurnForUsage(
        manager({
          daily: { used: 100, limit: 100 },
          credits: credits({ used: 130, state: "exhausted" }),
        }),
      ),
    ).resolves.toBe(false);
  });

  it("stops only past the runaway ceiling of included, grace, and the overrun cap", async () => {
    await expect(
      shouldStopTurnForUsage(
        manager({
          credits: credits({ used: 146, state: "exhausted" }),
          daily: { used: 0, limit: 100 },
        }),
      ),
    ).resolves.toBe(true);
  });

  it("falls back to message counts while credits are unconfigured", async () => {
    await expect(
      shouldStopTurnForUsage(manager({ daily: { used: 100, limit: 100 } })),
    ).resolves.toBe(true);
    await expect(shouldStopTurnForUsage(manager({ daily: { used: 5, limit: 100 } }))).resolves.toBe(
      false,
    );
  });
});
