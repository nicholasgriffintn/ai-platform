import { describe, expect, it } from "vitest";

import { createFakeRuntime } from "../testing/fake-usage-store.js";
import { userCreditActor } from "../usage/credit-actor.js";
import { applyUsageRollup, buildUsageEventRow } from "../usage/ledger.js";
import {
  planRunChargeAdjustments,
  reconcileRunCharge,
  resolveRunChargeTarget,
  runCapRemainingCreditMicros,
} from "../usage/run-charge.js";
import type { RunChargeGroup } from "../usage/store.js";

function group(overrides: Partial<RunChargeGroup> = {}): RunChargeGroup {
  return {
    user_id: 7,
    workspace_id: null,
    pool_workspace_id: null,
    project_id: null,
    conversation_id: "conversation-1",
    run_attempt: 1,
    period: "2026-10",
    source: "model",
    vendor: "anthropic",
    resource: "claude",
    unit: "output_tokens",
    credit_micros: 6_000_000,
    ...overrides,
  };
}

describe("resolveRunChargeTarget", () => {
  it("charges nothing for a refunded run, whatever its cap", () => {
    expect(
      resolveRunChargeTarget({
        refunded: true,
        capCreditMicros: 5_000_000,
        delegatedCreditMicros: 0,
      }),
    ).toEqual({
      creditMicros: 0,
      reason: "platform_failure_refund",
    });
  });

  it("leaves room for what delegates have spent or hold, so the family stays under the cap", () => {
    expect(
      resolveRunChargeTarget({
        refunded: false,
        capCreditMicros: 5_000_000,
        delegatedCreditMicros: 2_000_000,
      }),
    ).toEqual({ creditMicros: 3_000_000, reason: "run_cap_absorbed" });
  });

  it("leaves an uncapped, unrefunded run alone", () => {
    expect(
      resolveRunChargeTarget({ refunded: false, capCreditMicros: null, delegatedCreditMicros: 0 }),
    ).toBeNull();
  });
});

describe("runCapRemainingCreditMicros", () => {
  it("subtracts own and delegated spend, and never goes below zero", () => {
    const state = {
      capCreditMicros: 10_000_000,
      refunded: false,
      chargedCreditMicros: 4_000_000,
      delegatedCreditMicros: 3_000_000,
    };

    expect(runCapRemainingCreditMicros(state)).toBe(3_000_000);
    expect(runCapRemainingCreditMicros({ ...state, chargedCreditMicros: 9_000_000 })).toBe(0);
  });

  it("has nothing to report for an uncapped run", () => {
    expect(runCapRemainingCreditMicros(null)).toBeNull();
  });
});

describe("planRunChargeAdjustments", () => {
  it("returns every group in full for a refund, so reports net to zero by source", () => {
    const groups = [group(), group({ source: "capability", credit_micros: 2_000_000 })];
    const adjustments = planRunChargeAdjustments(groups, {
      creditMicros: 0,
      reason: "platform_failure_refund",
    });

    expect(adjustments.map((adjustment) => adjustment.creditMicros)).toEqual([
      6_000_000, 2_000_000,
    ]);
  });

  it("takes only the excess over a cap, from the newest period first", () => {
    const groups = [
      group({ period: "2026-09", credit_micros: 4_000_000 }),
      group({ period: "2026-10", credit_micros: 3_000_000 }),
    ];
    const adjustments = planRunChargeAdjustments(groups, {
      creditMicros: 5_000_000,
      reason: "run_cap_absorbed",
    });

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]?.group.period).toBe("2026-10");
    expect(adjustments[0]?.creditMicros).toBe(2_000_000);
  });
});

describe("reconcileRunCharge", () => {
  it("writes negative credits and keeps the vendor cost record intact", async () => {
    const { store, runtime } = createFakeRuntime({
      runCharge: {
        capCreditMicros: null,
        refunded: true,
        chargedCreditMicros: 6_000_000,
        delegatedCreditMicros: 0,
      },
      runChargeGroups: [group()],
    });

    await reconcileRunCharge(runtime, "run-1");

    const [runId, expected, events] = store.applyRunChargeAdjustments.mock.calls[0] ?? [];

    expect(runId).toBe("run-1");
    expect(expected).toBe(6_000_000);
    expect(events?.[0]).toMatchObject({
      credit_micros: -6_000_000,
      cost_micros: 0,
      quantity: 0,
      reason: "platform_failure_refund",
      run_attempt: 1,
    });
  });

  it("returns a pool-funded charge to the pool that paid it", async () => {
    const { store, runtime } = createFakeRuntime({
      runCharge: {
        capCreditMicros: null,
        refunded: true,
        chargedCreditMicros: 6_000_000,
        delegatedCreditMicros: 0,
      },
      runChargeGroups: [group({ workspace_id: "workspace-1", pool_workspace_id: "workspace-1" })],
    });

    await reconcileRunCharge(runtime, "run-1");

    const [, , events] = store.applyRunChargeAdjustments.mock.calls[0] ?? [];

    expect(events?.[0]).toMatchObject({
      credit_micros: -6_000_000,
      pool_workspace_id: "workspace-1",
    });
  });

  it("does nothing once the charge is already at the target", async () => {
    const { store, runtime } = createFakeRuntime({
      runCharge: {
        capCreditMicros: 5_000_000,
        refunded: false,
        chargedCreditMicros: 5_000_000,
        delegatedCreditMicros: 0,
      },
    });

    await reconcileRunCharge(runtime, "run-1");

    expect(store.applyRunChargeAdjustments).not.toHaveBeenCalled();
  });

  it("re-reads and retries when another writer changed the charge first", async () => {
    const { store, runtime } = createFakeRuntime({ runChargeGroups: [group()] });

    store.getRunChargeState
      .mockResolvedValueOnce({
        capCreditMicros: null,
        refunded: true,
        chargedCreditMicros: 6,
        delegatedCreditMicros: 0,
      })
      .mockResolvedValueOnce({
        capCreditMicros: null,
        refunded: true,
        chargedCreditMicros: 8,
        delegatedCreditMicros: 0,
      });
    store.applyRunChargeAdjustments.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await reconcileRunCharge(runtime, "run-1");

    expect(store.applyRunChargeAdjustments).toHaveBeenCalledTimes(2);
    expect(store.applyRunChargeAdjustments.mock.calls[1]?.[1]).toBe(8);
  });

  it("never throws into a billing path", async () => {
    const { store, runtime } = createFakeRuntime();

    store.getRunChargeState.mockRejectedValue(new Error("d1 unavailable"));

    await expect(reconcileRunCharge(runtime, "run-1")).resolves.toBeUndefined();
  });
});

describe("applyUsageRollup", () => {
  const event = (overrides: Record<string, unknown> = {}) =>
    buildUsageEventRow({
      idempotencyKey: "model:message-1:output_tokens",
      actor: userCreditActor(7),
      source: "model",
      vendor: "anthropic",
      resource: "claude",
      unit: "output_tokens",
      quantity: 1000,
      runId: "run-1",
      runAttempt: 1,
      occurredAt: "2026-10-31T12:00:00.000Z",
      rates: [
        {
          vendor: "anthropic",
          resource: "claude",
          unit: "output_tokens",
          perUnitMicros: 25,
          effectiveFrom: "2026-01-01",
        },
      ],
      ...overrides,
    });

  it("refunds usage that lands after the run was already refunded", async () => {
    const { store, runtime } = createFakeRuntime({
      runCharge: {
        capCreditMicros: null,
        refunded: true,
        chargedCreditMicros: 2_500_000,
        delegatedCreditMicros: 0,
      },
      runChargeGroups: [group({ credit_micros: 2_500_000 })],
    });

    await applyUsageRollup(runtime, [event()]);

    expect(store.insertEventAndApplyBalance).toHaveBeenCalledOnce();
    expect(store.applyRunChargeAdjustments.mock.calls[0]?.[2]?.[0]?.credit_micros).toBe(-2_500_000);
  });

  it("skips reconciliation for redelivered events and usage outside a run", async () => {
    const { store, runtime } = createFakeRuntime({ insert: () => false });
    const duplicate = event();

    await applyUsageRollup(runtime, [duplicate]);

    store.insertEventAndApplyBalance.mockResolvedValue(true);
    await applyUsageRollup(runtime, [event({ runId: null })]);

    expect(store.getRunChargeState).not.toHaveBeenCalled();
  });
});

describe("a capped run whose last step cost more than its estimate", () => {
  it("absorbs the overshoot so the person is charged exactly the cap", async () => {
    const { store, runtime } = createFakeRuntime({
      runCharge: {
        capCreditMicros: 100_000_000,
        refunded: false,
        chargedCreditMicros: 130_000_000,
        delegatedCreditMicros: 0,
      },
      runChargeGroups: [group({ credit_micros: 130_000_000 })],
    });

    await reconcileRunCharge(runtime, "run-1");

    const events = store.applyRunChargeAdjustments.mock.calls[0]?.[2] ?? [];
    const absorbed = events.reduce((total, event) => total + event.credit_micros, 0);

    expect(130_000_000 + absorbed).toBe(100_000_000);
    expect(events[0]?.reason).toBe("run_cap_absorbed");
  });
});
