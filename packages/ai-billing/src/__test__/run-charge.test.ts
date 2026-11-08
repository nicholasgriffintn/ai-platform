import { describe, expect, it } from "vitest";

import { createFakeRuntime } from "../testing/fake-usage-store.js";
import { userCreditActor } from "../usage/credit-actor.js";
import { applyUsageRollup, buildUsageEventRow } from "../usage/ledger.js";
import { planRunChargeAdjustments, reconcileRunCharge } from "../usage/run-charge.js";
import type { RunChargeGroup } from "../usage/store.js";

function group(overrides: Partial<RunChargeGroup> = {}): RunChargeGroup {
  return {
    user_id: 7,
    workspace_id: null,
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

describe("planRunChargeAdjustments", () => {
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
      runCharge: { capCreditMicros: null, refunded: true, chargedCreditMicros: 2_500_000 },
      runChargeGroups: [group({ credit_micros: 2_500_000 })],
    });

    await applyUsageRollup(runtime, [event()]);

    expect(store.insertEventAndApplyBalance).toHaveBeenCalledOnce();
    expect(store.applyRunChargeAdjustments.mock.calls[0]?.[2]?.[0]?.credit_micros).toBe(-2_500_000);
  });
});

describe("a capped run whose last step cost more than its estimate", () => {
  it("absorbs the overshoot so the person is charged exactly the cap", async () => {
    const { store, runtime } = createFakeRuntime({
      runCharge: {
        capCreditMicros: 100_000_000,
        refunded: false,
        chargedCreditMicros: 130_000_000,
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
