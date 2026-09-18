import { creditMicrosFromCredits } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { userCreditActor } from "../usage/credit-actor.js";
import { admitTurn, readCreditPosition } from "../usage/credits.js";
import {
  defaultGraceCreditMicros,
  resolvePlanAllowanceCredits,
  resolveUsagePlanSeed,
} from "../usage/plan-seed.js";
import { createFakeRuntime, createFakeUsageStore } from "./fake-usage-store.js";

const configuredPlan = { included_credits: 100, grace_credits: null };

describe("defaultGraceCreditMicros", () => {
  it("grants a tenth of the included credits, floored at fifty and capped at half", () => {
    expect(defaultGraceCreditMicros(1_000_000_000)).toBe(100_000_000);
    expect(defaultGraceCreditMicros(100_000_000)).toBe(50_000_000);
    expect(defaultGraceCreditMicros(15_000_000)).toBe(7_500_000);
    expect(defaultGraceCreditMicros(0)).toBe(0);
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

describe("resolveUsagePlanSeed", () => {
  it("treats a user with no plan as free and reads that plan row", async () => {
    const store = createFakeUsageStore({
      userPlanId: null,
      plan: { included_credits: 100, grace_credits: 0 },
    });

    await expect(resolveUsagePlanSeed(store, 1)).resolves.toMatchObject({
      planId: "free",
      includedCreditMicros: creditMicrosFromCredits(100),
      graceCreditMicros: 0,
    });
    expect(store.getPlanAllowance).toHaveBeenCalledWith("free");
  });

  it("marks an unreadable plan as unavailable rather than as a real allowance", async () => {
    const store = createFakeUsageStore();

    store.getUserPlanId.mockRejectedValue(new Error("database unavailable"));

    await expect(resolveUsagePlanSeed(store, 7)).resolves.toMatchObject({
      resolution: "unavailable",
      includedCreditMicros: 0,
    });
  });
});

describe("readCreditPosition", () => {
  it("reports an unenforced position when the plan resolves to no allowance", async () => {
    const { store, runtime } = createFakeRuntime({ plan: { included_credits: null } });

    const position = await readCreditPosition(runtime, {
      actor: userCreditActor(7),
      planId: "bespoke-unmetered",
    });

    expect(position).toMatchObject({ enforced: false, state: "exhausted" });
    expect(store.getUserBalance).not.toHaveBeenCalled();
  });
});

describe("admitTurn", () => {
  it("admits a turn that fits and reserves its estimate", async () => {
    const { store, runtime } = createFakeRuntime({ plan: configuredPlan });

    const admission = await admitTurn(runtime, {
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
    expect(admission.admitted && admission.reservation).toBeTruthy();
    expect(store.applyUserBalanceDeltas.mock.calls[0][0]).toMatchObject({
      userId: 7,
      includedCreditMicros: 100_000_000,
      graceCreditMicros: 50_000_000,
      deltas: { reserved_credit_micros: 10_000_000 },
    });
  });

  it("admits an estimate that exactly fills the ceiling", async () => {
    const { runtime } = createFakeRuntime({
      plan: configuredPlan,
      balance: { spent_credit_micros: 140_000_000 },
    });

    const admission = await admitTurn(runtime, {
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
  });

  it("refuses a turn that does not fit and writes nothing", async () => {
    const { store, runtime } = createFakeRuntime({
      plan: configuredPlan,
      balance: { spent_credit_micros: 145_000_000 },
    });

    const admission = await admitTurn(runtime, {
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(false);
    expect(store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });

  it("admits past the ceiling when overage is enabled", async () => {
    const { store, runtime } = createFakeRuntime({
      plan: configuredPlan,
      balance: { spent_credit_micros: 145_000_000, overage_enabled: 1 },
    });

    const admission = await admitTurn(runtime, {
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    expect(admission.admitted).toBe(true);
    expect(store.applyUserBalanceDeltas).toHaveBeenCalledTimes(1);
  });

  it("refuses a plan that resolves to no allowance rather than letting it run free", async () => {
    const { store, runtime } = createFakeRuntime({ plan: { included_credits: null } });

    const admission = await admitTurn(runtime, {
      actor: userCreditActor(7),
      planId: "bespoke-unmetered",
      estimatedCreditMicros: 1_000,
    });

    expect(admission.admitted).toBe(false);
    expect(admission.position.state).toBe("exhausted");
    expect(store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });

  it("releases a reservation exactly once however many times settlement retries", async () => {
    const { store, runtime } = createFakeRuntime({ plan: configuredPlan });

    const admission = await admitTurn(runtime, {
      actor: userCreditActor(7),
      planId: "pro",
      estimatedCreditMicros: 10_000_000,
    });

    if (!admission.admitted || !admission.reservation) {
      throw new Error("Expected an admitted turn with a reservation");
    }

    await admission.reservation.release();
    await admission.reservation.release();

    const releases = store.applyUserBalanceDeltas.mock.calls.filter(
      (call) => call[0].deltas.reserved_credit_micros === -10_000_000,
    );

    expect(releases).toHaveLength(1);
  });

  it("persists a durable chat reservation under the exact run identity", async () => {
    const { store, publisher, runtime } = createFakeRuntime({
      plan: configuredPlan,
      reservation: {
        id: "res-1",
        user_id: 7,
        period: "2026-09",
        kind: "chat_run",
        ref_id: "run-1",
        credit_micros: 10_000_000,
        status: "held",
        expires_at: null,
      },
    });

    const admission = await admitTurn(runtime, {
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
    expect(store.createUserReservationWithBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        kind: "chat_run",
        refId: "run-1",
        userId: 7,
        creditMicros: 10_000_000,
        expiresAt: "2026-09-06T10:00:00.000Z",
      }),
    );
    expect(store.applyUserBalanceDeltas).not.toHaveBeenCalled();
    expect(publisher.usageChanged).toHaveBeenCalledWith(7, expect.any(String));

    if (!admission.admitted || !admission.reservation) {
      throw new Error("Expected a durable reservation");
    }

    await admission.reservation.release("settled");
    await admission.reservation.release("released");

    expect(store.finishUserReservationWithBalance).toHaveBeenCalledOnce();
    expect(store.finishUserReservationWithBalance).toHaveBeenCalledWith(
      "chat_run",
      "run-1",
      "settled",
      store.createUserReservationWithBalance.mock.calls[0]?.[0].id,
    );
  });
});
