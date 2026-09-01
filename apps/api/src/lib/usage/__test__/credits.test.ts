import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import {
  admitTurn,
  estimateTurnCreditMicros,
  overrunCapCreditMicros,
  shouldStopRunaway,
} from "../credits";
import { defaultGraceCreditMicros } from "../planSeed";

function createRepositories(
  options: {
    plan?: Record<string, unknown> | null;
    balance?: Record<string, unknown> | null;
  } = {},
) {
  const applyDeltas = vi.fn(async (_params: Record<string, unknown>) => {});
  const getBalance = vi.fn(async () => options.balance ?? null);

  return {
    applyDeltas,
    getBalance,
    repositories: {
      plans: { getPlanById: vi.fn(async () => options.plan ?? null) },
      usageBalances: { applyDeltas, getBalance },
    } as any,
  };
}

function summary(overrides: Partial<UsageCreditsSummary> = {}): UsageCreditsSummary {
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

describe("defaultGraceCreditMicros", () => {
  it("grants a tenth of the included credits", () => {
    expect(defaultGraceCreditMicros(1_000_000_000)).toBe(100_000_000);
  });

  it("never grants less than fifty credits", () => {
    expect(defaultGraceCreditMicros(100_000_000)).toBe(50_000_000);
    expect(defaultGraceCreditMicros(0)).toBe(50_000_000);
  });
});

describe("overrunCapCreditMicros", () => {
  it("caps the overrun at a quarter of the grace", () => {
    expect(overrunCapCreditMicros(200_000_000)).toBe(50_000_000);
  });

  it("never caps below twenty-five credits", () => {
    expect(overrunCapCreditMicros(40_000_000)).toBe(25_000_000);
  });
});

describe("estimateTurnCreditMicros", () => {
  const modelConfig = {
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    maxTokens: 1000,
  };

  it("prices the prompt at the input rate plus the output allowance", () => {
    expect(estimateTurnCreditMicros({ promptTokens: 2000, modelConfig })).toBe(2_100_000);
  });

  it("caps the output allowance at eight thousand tokens' worth", () => {
    const estimate = estimateTurnCreditMicros({
      promptTokens: 0,
      modelConfig: { ...modelConfig, maxTokens: 64_000 },
    });

    expect(estimate).toBe(12_288_000);
  });

  it("estimates zero for a model with no cost data rather than blocking it", () => {
    expect(estimateTurnCreditMicros({ promptTokens: 5000, modelConfig: null })).toBe(0);
  });
});

describe("shouldStopRunaway", () => {
  it("holds until spend passes included, grace, and the overrun cap together", () => {
    expect(shouldStopRunaway(summary({ used: 145, state: "exhausted" }))).toBe(false);
    expect(shouldStopRunaway(summary({ used: 146, state: "exhausted" }))).toBe(true);
  });

  it("never fires inside the reserve", () => {
    expect(shouldStopRunaway(summary({ used: 110, state: "reserve" }))).toBe(false);
  });
});

describe("admitTurn", () => {
  const configuredPlan = { included_credits: 100, grace_credits: null };

  it("admits a turn that fits and reserves its estimate", async () => {
    const { applyDeltas, repositories } = createRepositories({
      plan: configuredPlan,
    });

    const admission = await admitTurn({
      repositories,
      userId: 7,
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
    expect(admission.admitted && admission.reservation).toBeTruthy();
    expect(applyDeltas.mock.calls[0][0]).toMatchObject({
      userId: 7,
      includedCreditMicros: 100_000_000,
      graceCreditMicros: 50_000_000,
      deltas: { reserved_credit_micros: 10_000_000 },
    });
  });

  it("admits an estimate that exactly fills the ceiling", async () => {
    const { repositories } = createRepositories({
      plan: configuredPlan,
      balance: { spent_credit_micros: 140_000_000 },
    });

    const admission = await admitTurn({
      repositories,
      userId: 7,
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
  });

  it("refuses a turn that does not fit and writes nothing", async () => {
    const { applyDeltas, repositories } = createRepositories({
      plan: configuredPlan,
      balance: { spent_credit_micros: 145_000_000 },
    });

    const admission = await admitTurn({
      repositories,
      userId: 7,
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(false);
    expect(applyDeltas).not.toHaveBeenCalled();
  });

  it("admits past the ceiling when overage is enabled", async () => {
    const { applyDeltas, repositories } = createRepositories({
      plan: configuredPlan,
      balance: { spent_credit_micros: 145_000_000, overage_enabled: 1 },
    });

    const admission = await admitTurn({
      repositories,
      userId: 7,
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
    expect(applyDeltas).toHaveBeenCalledTimes(1);
  });

  it("admits everything while the plan has no credits configured", async () => {
    const { applyDeltas, getBalance, repositories } = createRepositories({
      plan: { included_credits: null },
    });

    const admission = await admitTurn({
      repositories,
      userId: 7,
      planId: "free",
      estimatedCreditMicros: 999_000_000_000,
    });

    expect(admission.admitted).toBe(true);
    expect(admission.admitted && admission.reservation).toBeNull();
    expect(getBalance).not.toHaveBeenCalled();
    expect(applyDeltas).not.toHaveBeenCalled();
  });

  it("releases a reservation exactly once however many times settlement retries", async () => {
    const { applyDeltas, repositories } = createRepositories({ plan: configuredPlan });

    const admission = await admitTurn({
      repositories,
      userId: 7,
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    if (!admission.admitted || !admission.reservation) {
      throw new Error("Expected an admitted turn with a reservation");
    }

    await admission.reservation.release();
    await admission.reservation.release();

    const releases = applyDeltas.mock.calls.filter(
      (call) =>
        (call[0] as { deltas?: { reserved_credit_micros?: number } }).deltas
          ?.reserved_credit_micros === -10_000_000,
    );

    expect(releases).toHaveLength(1);
  });
});
