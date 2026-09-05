import { creditMicrosFromCredits, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { userCreditActor } from "../creditActor";
import {
  admitTurn,
  estimateTurnCreditMicros,
  overrunCapCreditMicros,
  shouldStopRunaway,
} from "../credits";
import {
  defaultGraceCreditMicros,
  resolvePlanAllowanceCredits,
  resolveUsagePlanSeed,
} from "../planSeed";

function createRepositories(
  options: {
    plan?: Record<string, unknown> | null;
    balance?: Record<string, unknown> | null;
  } = {},
) {
  const applyDeltas = vi.fn(async (_params: Record<string, unknown>) => {});
  const getBalance = vi.fn(async () => options.balance ?? null);
  const createUserReservationWithBalance = vi.fn(async () => true);
  const finishUserReservationWithBalance = vi.fn(async () => ({ ref_id: "run-1" }));
  const getReservation = vi.fn(async () => ({
    kind: "chat_run",
    ref_id: "run-1",
    status: "held",
    credit_micros: 10_000_000,
  }));

  return {
    applyDeltas,
    getBalance,
    repositories: {
      plans: { getPlanById: vi.fn(async () => options.plan ?? null) },
      usageBalances: { applyDeltas, getBalance },
      usageReservations: {
        createUserReservationWithBalance,
        finishUserReservationWithBalance,
        getReservation,
      },
    } as any,
    createUserReservationWithBalance,
    finishUserReservationWithBalance,
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
  });

  it("never grants more than half the included credits", () => {
    expect(defaultGraceCreditMicros(15_000_000)).toBe(7_500_000);
    expect(defaultGraceCreditMicros(0)).toBe(0);
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
      actor: userCreditActor(7),
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
      actor: userCreditActor(7),
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
      actor: userCreditActor(7),
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
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
    expect(applyDeltas).toHaveBeenCalledTimes(1);
  });

  it("refuses a plan that resolves to no allowance rather than letting it run free", async () => {
    const { applyDeltas, getBalance, repositories } = createRepositories({
      plan: { included_credits: null },
    });

    const admission = await admitTurn({
      repositories,
      actor: userCreditActor(7),
      planId: "bespoke-unmetered",
      estimatedCreditMicros: 1_000,
    });

    expect(admission.admitted).toBe(false);
    expect(admission.position.state).toBe("exhausted");
    expect(getBalance).not.toHaveBeenCalled();
    expect(applyDeltas).not.toHaveBeenCalled();
  });

  it("releases a reservation exactly once however many times settlement retries", async () => {
    const { applyDeltas, repositories } = createRepositories({ plan: configuredPlan });

    const admission = await admitTurn({
      repositories,
      actor: userCreditActor(7),
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

  it("persists a project-task chat reservation under the exact run identity", async () => {
    const {
      applyDeltas,
      createUserReservationWithBalance,
      finishUserReservationWithBalance,
      repositories,
    } = createRepositories({
      plan: configuredPlan,
    });

    const admission = await admitTurn({
      repositories,
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
      durableReservation: {
        kind: "chat_run",
        refId: "run-1",
        userId: 7,
        expiresAt: "2026-09-06T10:00:00.000Z",
      },
    });

    expect(admission.admitted).toBe(true);
    expect(createUserReservationWithBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "chat_run:run-1",
        kind: "chat_run",
        refId: "run-1",
        userId: 7,
        creditMicros: 10_000_000,
        expiresAt: "2026-09-06T10:00:00.000Z",
      }),
    );
    expect(applyDeltas).not.toHaveBeenCalled();

    if (!admission.admitted || !admission.reservation) {
      throw new Error("Expected a durable reservation");
    }

    await admission.reservation.release("settled");
    await admission.reservation.release("released");

    expect(finishUserReservationWithBalance).toHaveBeenCalledOnce();
    expect(finishUserReservationWithBalance).toHaveBeenCalledWith("chat_run", "run-1", "settled");
  });
});

describe("resolvePlanAllowanceCredits", () => {
  it("uses the built-in allowance and derived reserve when plan credits are unconfigured", () => {
    expect(resolvePlanAllowanceCredits("anonymous", null, null)).toEqual({
      includedCredits: 15,
      graceCredits: 7.5,
    });
    expect(resolvePlanAllowanceCredits("free", null, null)).toEqual({
      includedCredits: 150,
      graceCredits: 50,
    });
    expect(resolvePlanAllowanceCredits("pro", null, null)).toEqual({
      includedCredits: 1500,
      graceCredits: 150,
    });
    expect(resolvePlanAllowanceCredits("enterprise", null, null)).toEqual({
      includedCredits: 15_000,
      graceCredits: 1500,
    });
  });

  it("derives the reserve from the configured allowance for paid plans", () => {
    expect(resolvePlanAllowanceCredits("pro", 4000, 100)).toEqual({
      includedCredits: 4000,
      graceCredits: 100,
    });
  });

  it("reports an unknown plan with no configured credits as unmetered", () => {
    expect(resolvePlanAllowanceCredits("bespoke-unmetered", null, null)).toBeNull();
  });
});

describe("plan defaults for signed-in accounts", () => {
  it("treats a user with no plan as free and reads that plan row", async () => {
    const getPlanById = vi.fn(async () => ({ included_credits: 100, grace_credits: 0 }));
    const repositories = {
      users: { getUserById: async () => ({ id: 1, plan_id: null }) },
      plans: { getPlanById },
    } as never;

    await expect(resolveUsagePlanSeed(repositories, 1)).resolves.toMatchObject({
      planId: "free",
      includedCreditMicros: creditMicrosFromCredits(100),
      graceCreditMicros: 0,
    });
    expect(getPlanById).toHaveBeenCalledWith("free");
  });
});

describe("unresolvable plans fail closed", () => {
  it("marks an unreadable plan as unavailable rather than as a real allowance", async () => {
    const repositories = {
      users: {
        getUserById: async () => {
          throw new Error("database unavailable");
        },
      },
      plans: { getPlanById: async () => null },
    } as never;

    await expect(resolveUsagePlanSeed(repositories, 7)).resolves.toMatchObject({
      resolution: "unavailable",
      includedCreditMicros: 0,
    });
  });

  it("refuses a turn when no allowance resolves rather than spending freely", async () => {
    const { repositories } = createRepositories({ plan: { included_credits: null } });

    const admission = await admitTurn({
      repositories,
      actor: userCreditActor(7),
      planId: "bespoke-unmetered",
      estimatedCreditMicros: 1_000,
    });

    expect(admission.admitted).toBe(false);
    expect(admission.position.state).toBe("exhausted");
  });
});
