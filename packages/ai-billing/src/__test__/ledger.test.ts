import type { RateEntry } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { userCreditActor } from "../usage/credit-actor.js";
import { buildUsageEventRow } from "../usage/ledger.js";

const OCCURRED_AT = "2026-08-31T12:00:00.000Z";

const MODEL_RATES: RateEntry[] = [
  {
    vendor: "anthropic",
    resource: "claude-4.6-opus",
    unit: "input_tokens",
    perUnitMicros: 5,
    effectiveFrom: "2026-01-01",
  },
  {
    vendor: "anthropic",
    resource: "claude-4.6-opus",
    unit: "output_tokens",
    perUnitMicros: 25,
    effectiveFrom: "2026-01-01",
  },
];

function draft(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "model:message-1:input_tokens",
    actor: userCreditActor(7),
    source: "model" as const,
    vendor: "anthropic",
    resource: "claude-4.6-opus",
    unit: "input_tokens" as const,
    quantity: 1000,
    occurredAt: OCCURRED_AT,
    rates: MODEL_RATES,
    ...overrides,
  };
}

describe("buildUsageEventRow", () => {
  it("records BYOK model cost for visibility but charges no credits", () => {
    const row = buildUsageEventRow(draft({ byok: true }));

    expect(row.cost_micros).toBe(5000);
    expect(row.credit_micros).toBe(0);
    expect(row.billable).toBe(false);
    expect(row.byok).toBe(true);
  });

  it("charges infrastructure even when the turn used the user's own key", () => {
    const row = buildUsageEventRow(
      draft({
        source: "infrastructure",
        byok: true,
        vendor: "cloudflare",
        resource: "containers",
        unit: "container_vcpu_seconds",
        quantity: 100,
        rates: [
          {
            vendor: "cloudflare",
            resource: "containers",
            unit: "container_vcpu_seconds",
            perUnitMicros: 20,
            effectiveFrom: "2026-08-31",
          },
        ],
      }),
    );

    expect(row.cost_micros).toBe(2000);
    expect(row.credit_micros).toBe(200_000);
    expect(row.billable).toBe(true);
  });

  it("keeps a rate miss free and estimated so a turn is never blocked on pricing", () => {
    const row = buildUsageEventRow(draft({ resource: "unpriced-model", rates: [] }));

    expect(row.cost_micros).toBe(0);
    expect(row.credit_micros).toBe(0);
    expect(row.billable).toBe(false);
    expect(row.estimated).toBe(true);
  });
});
