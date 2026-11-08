import { describe, expect, it } from "vitest";

import { createFakeRuntime } from "../testing/fake-usage-store.js";
import { userCreditActor } from "../usage/credit-actor.js";
import { admitTurn } from "../usage/credits.js";

const configuredPlan = { included_credits: 100, grace_credits: null };

describe("admitTurn", () => {
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
});
