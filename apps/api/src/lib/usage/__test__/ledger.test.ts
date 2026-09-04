import type { RateEntry } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { UsageEventInsert } from "~/repositories/UsageEventRepository";

import { billableTokenQuantities } from "../billableUnits";
import { userCreditActor } from "../creditActor";
import { resolveCreditState } from "../creditState";
import { applyUsageRollup, buildUsageEventRow, emitUsageEvents } from "../ledger";
import { normaliseTokenUsage, type NormalisedTokenUsage } from "../tokenUsage";

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

function tokenUsage(overrides: Partial<NormalisedTokenUsage> = {}): NormalisedTokenUsage {
  return {
    input_tokens: 1000,
    output_tokens: 200,
    total_tokens: 1200,
    prompt_tokens: 1000,
    completion_tokens: 200,
    ...overrides,
  };
}

function createRepositories(options: { insert?: (event: UsageEventInsert) => boolean } = {}) {
  const insertEventAndApplyBalance = vi.fn(
    async (
      event: UsageEventInsert,
      _seed: { planId: string | null; includedCreditMicros: number; graceCreditMicros: number },
    ) => options.insert?.(event) ?? true,
  );

  return {
    insertEventAndApplyBalance,
    repositories: {
      usageEvents: { insertEventAndApplyBalance },
      users: { getUserById: vi.fn(async () => ({ plan_id: "pro" })) },
      plans: { getPlanById: vi.fn(async () => ({ included_credits: 500, grace_credits: 50 })) },
      tasks: {},
    } as any,
  };
}

describe("buildUsageEventRow", () => {
  it("prices a metered event into micro-USD and micro-credits", () => {
    const row = buildUsageEventRow(draft());

    expect(row.cost_micros).toBe(5000);
    expect(row.credit_micros).toBe(500_000);
    expect(row.period).toBe("2026-08");
    expect(row.estimated).toBe(false);
    expect(row.billable).toBe(true);
  });

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
    expect(row.estimated).toBe(true);
  });

  it("preserves the provider payload verbatim so history can be repriced", () => {
    const raw = { input_tokens: 1000, cache_read_input_tokens: 40 };
    const row = buildUsageEventRow(draft({ raw }));

    expect(JSON.parse(row.raw ?? "null")).toEqual(raw);
  });
});

describe("applyUsageRollup", () => {
  it("counts only events atomically inserted with their balance projection", async () => {
    const { insertEventAndApplyBalance, repositories } = createRepositories({
      insert: (event) => event.unit === "input_tokens",
    });

    const events = [
      buildUsageEventRow(draft()),
      buildUsageEventRow(
        draft({
          idempotencyKey: "model:message-1:output_tokens",
          unit: "output_tokens",
          quantity: 200,
        }),
      ),
    ];

    const result = await applyUsageRollup(repositories, events);

    expect(result.inserted).toBe(1);
    expect(insertEventAndApplyBalance).toHaveBeenCalledTimes(2);
    expect(insertEventAndApplyBalance.mock.calls[0][1]).toEqual({
      planId: "pro",
      includedCreditMicros: 500_000_000,
      graceCreditMicros: 50_000_000,
      resolution: "allowance",
    });
  });

  it("moves no credits when every event is a replay of one already recorded", async () => {
    const { insertEventAndApplyBalance, repositories } = createRepositories({
      insert: () => false,
    });

    const result = await applyUsageRollup(repositories, [buildUsageEventRow(draft())]);

    expect(result.inserted).toBe(0);
    expect(insertEventAndApplyBalance).toHaveBeenCalledOnce();
  });

  it("passes BYOK events through the same idempotent ledger seam", async () => {
    const { insertEventAndApplyBalance, repositories } = createRepositories();

    await applyUsageRollup(repositories, [buildUsageEventRow(draft({ byok: true }))]);

    expect(insertEventAndApplyBalance).toHaveBeenCalledWith(
      expect.objectContaining({ billable: false, credit_micros: 0 }),
      expect.any(Object),
    );
  });

  it("records spend after its attributed conversation has been deleted", async () => {
    const { insertEventAndApplyBalance, repositories } = createRepositories();

    repositories.conversations = { getConversation: vi.fn(async () => null) };
    const event = buildUsageEventRow(
      draft({
        conversationId: "deleted-conversation",
      }),
    );

    await applyUsageRollup(repositories, [event]);

    expect(insertEventAndApplyBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: null,
      }),
      expect.any(Object),
    );
  });
});

describe("emitUsageEvents", () => {
  it("writes the ledger directly when there is no queue binding", async () => {
    const { insertEventAndApplyBalance, repositories } = createRepositories();

    await expect(
      emitUsageEvents({ env: {} as any, repositories, drafts: [draft()] }),
    ).resolves.toBe("written");
    expect(insertEventAndApplyBalance).toHaveBeenCalledTimes(1);
  });

  it("falls back to a direct write when enqueueing fails rather than losing the event", async () => {
    const { insertEventAndApplyBalance, repositories } = createRepositories();

    repositories.tasks = {
      createTask: vi.fn(async () => {
        throw new Error("queue unavailable");
      }),
    };

    await expect(
      emitUsageEvents({ env: { TASK_QUEUE: {} } as any, repositories, drafts: [draft()] }),
    ).resolves.toBe("written");
    expect(insertEventAndApplyBalance).toHaveBeenCalledTimes(1);
  });

  it("never throws out of a billing path when the ledger is unwritable", async () => {
    const { repositories } = createRepositories();

    repositories.usageEvents.insertEventAndApplyBalance = vi.fn(async () => {
      throw new Error("d1 unavailable");
    });

    await expect(
      emitUsageEvents({ env: {} as any, repositories, drafts: [draft()] }),
    ).resolves.toBe("failed");
  });
});

describe("billableTokenQuantities", () => {
  it("keeps input whole when the provider reports cache reads as additional", () => {
    const quantities = billableTokenQuantities(
      tokenUsage({ cached_input_tokens: 400, cache_creation_tokens: 100 }),
      { input_tokens: 1000, cache_read_input_tokens: 400, cache_creation_input_tokens: 100 },
    );

    expect(quantities).toEqual([
      { unit: "input_tokens", quantity: 1000 },
      { unit: "output_tokens", quantity: 200 },
      { unit: "cached_input_tokens", quantity: 400 },
      { unit: "cache_write_5m_tokens", quantity: 100 },
    ]);
  });

  it("subtracts cache reads from input when the provider counts them inside the prompt", () => {
    const quantities = billableTokenQuantities(tokenUsage({ cached_input_tokens: 400 }), {
      prompt_tokens: 1000,
      prompt_tokens_details: { cached_tokens: 400 },
    });

    expect(quantities).toEqual([
      { unit: "input_tokens", quantity: 600 },
      { unit: "output_tokens", quantity: 200 },
      { unit: "cached_input_tokens", quantity: 400 },
    ]);
  });

  it("prices OpenAI cache writes and long-context requests as disjoint token units", () => {
    const raw = {
      input_tokens: 300000,
      output_tokens: 10000,
      input_tokens_details: { cached_tokens: 50000, cache_write_tokens: 25000 },
    };
    const usage = normaliseTokenUsage(raw);

    if (!usage) {
      throw new Error("Expected OpenAI usage to normalise");
    }

    expect(
      billableTokenQuantities(usage, raw, {
        hasGenericCacheWriteRate: true,
        longContextThresholdTokens: 272000,
      }),
    ).toEqual([
      { unit: "long_context_input_tokens", quantity: 225000 },
      { unit: "long_context_output_tokens", quantity: 10000 },
      { unit: "long_context_cached_input_tokens", quantity: 50000 },
      { unit: "long_context_cache_write_tokens", quantity: 25000 },
    ]);
  });

  it("leaves reasoning folded into output unless the model prices it separately", () => {
    const usage = tokenUsage({ reasoning_tokens: 50 });
    const raw = { completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 50 } };

    expect(billableTokenQuantities(usage, raw)).toEqual([
      { unit: "input_tokens", quantity: 1000 },
      { unit: "output_tokens", quantity: 200 },
    ]);

    expect(billableTokenQuantities(usage, raw, { hasReasoningRate: true })).toEqual([
      { unit: "input_tokens", quantity: 1000 },
      { unit: "output_tokens", quantity: 150 },
      { unit: "reasoning_tokens", quantity: 50 },
    ]);
  });
});

describe("resolveCreditState", () => {
  const balance = {
    includedCreditMicros: 1000,
    graceCreditMicros: 200,
    spentCreditMicros: 0,
    reservedCreditMicros: 0,
    overageEnabled: false,
  };

  it("counts reservations against the allowance alongside spend", () => {
    expect(
      resolveCreditState({ ...balance, spentCreditMicros: 600, reservedCreditMicros: 399 }),
    ).toBe("ok");
    expect(
      resolveCreditState({ ...balance, spentCreditMicros: 600, reservedCreditMicros: 400 }),
    ).toBe("reserve");
  });

  it("stays in reserve until the grace allowance is gone", () => {
    expect(resolveCreditState({ ...balance, spentCreditMicros: 1199 })).toBe("reserve");
    expect(resolveCreditState({ ...balance, spentCreditMicros: 1200 })).toBe("exhausted");
  });

  it("keeps spending past the reserve only when overage is enabled", () => {
    expect(resolveCreditState({ ...balance, spentCreditMicros: 5000, overageEnabled: true })).toBe(
      "overage",
    );
    expect(resolveCreditState({ ...balance, spentCreditMicros: 5000 })).toBe("exhausted");
  });
});
