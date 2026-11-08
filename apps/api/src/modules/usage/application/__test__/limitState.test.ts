import { describe, expect, it, vi } from "vitest";

import {
  isUsageExhausted,
  readUsageLimitState,
  shouldStopTurnForUsage,
} from "~/modules/usage/application/limitState";

function manager(limits: unknown) {
  return { getUsageLimits: vi.fn(async () => limits) } as any;
}

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

describe("readUsageLimitState", () => {
  it("reports a spent credit balance as exhausted", async () => {
    const state = await readUsageLimitState(
      manager({ credits: credits({ used: 125, state: "exhausted" }) }),
    );

    expect(state.exhausted).toBe(true);
    expect(state.credits).toMatchObject({ state: "exhausted" });
  });

  it("treats an unreadable balance as not exhausted so a storage blip cannot lock a user out", async () => {
    const failing = {
      getUsageLimits: vi.fn(async () => {
        throw new Error("d1 unavailable");
      }),
    } as any;

    await expect(isUsageExhausted(failing)).resolves.toBe(false);
    await expect(isUsageExhausted(manager(null))).resolves.toBe(false);
    await expect(isUsageExhausted(manager({}))).resolves.toBe(false);
  });
});

describe("shouldStopTurnForUsage", () => {
  it("stops only past the runaway ceiling of included, grace, and the overrun cap", async () => {
    await expect(
      shouldStopTurnForUsage(manager({ credits: credits({ used: 146, state: "exhausted" }) })),
    ).resolves.toBe(true);
  });
});
