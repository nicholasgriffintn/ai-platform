import type { RateEntry } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { userCreditActor } from "../usage/credit-actor.js";
import { applyUsageRollup, buildUsageEventRow, emitUsageEvents } from "../usage/ledger.js";
import { createFakeRuntime } from "./fake-usage-store.js";

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
    expect(row.billable).toBe(false);
    expect(row.estimated).toBe(true);
  });

  it("preserves the provider payload verbatim so history can be repriced", () => {
    const raw = { input_tokens: 1000, cache_read_input_tokens: 40 };
    const row = buildUsageEventRow(draft({ raw }));

    expect(JSON.parse(row.raw ?? "null")).toEqual(raw);
  });

  it("preserves the exact run and attempt across queued ledger rollups", () => {
    const row = buildUsageEventRow(draft({ runId: "run-1", runAttempt: 2 }));

    expect(row.run_id).toBe("run-1");
    expect(row.run_attempt).toBe(2);
  });
});

describe("applyUsageRollup", () => {
  it("counts only events atomically inserted with their balance projection", async () => {
    const { store, runtime } = createFakeRuntime({
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

    const result = await applyUsageRollup(runtime, events);

    expect(result.inserted).toBe(1);
    expect(store.insertEventAndApplyBalance).toHaveBeenCalledTimes(2);
    expect(store.insertEventAndApplyBalance.mock.calls[0][1]).toEqual({
      planId: "pro",
      includedCreditMicros: 500_000_000,
      graceCreditMicros: 50_000_000,
      resolution: "allowance",
    });
  });

  it("moves no credits when every event is a replay of one already recorded", async () => {
    const { store, runtime } = createFakeRuntime({ insert: () => false });

    const result = await applyUsageRollup(runtime, [buildUsageEventRow(draft())]);

    expect(result.inserted).toBe(0);
    expect(store.insertEventAndApplyBalance).toHaveBeenCalledOnce();
  });

  it("drops events for accounts that no longer exist", async () => {
    const { store, runtime } = createFakeRuntime({ userExists: false });

    const result = await applyUsageRollup(runtime, [buildUsageEventRow(draft())]);

    expect(result.inserted).toBe(0);
    expect(store.insertEventAndApplyBalance).not.toHaveBeenCalled();
  });

  it("records spend after its attributed conversation has been deleted", async () => {
    const { store, runtime } = createFakeRuntime({ conversationExists: false });
    const event = buildUsageEventRow(draft({ conversationId: "deleted-conversation" }));

    await applyUsageRollup(runtime, [event]);

    expect(store.insertEventAndApplyBalance).toHaveBeenCalledWith(
      expect.objectContaining({ conversation_id: null }),
      expect.any(Object),
    );
  });

  it("announces a balance change once per user, and not for zero-credit events", async () => {
    const { publisher, runtime } = createFakeRuntime();

    await applyUsageRollup(runtime, [
      buildUsageEventRow(draft()),
      buildUsageEventRow(draft({ idempotencyKey: "model:message-1:output_tokens" })),
      buildUsageEventRow(
        draft({
          idempotencyKey: "infra:request-1:d1_rows_read",
          actor: userCreditActor(9),
          source: "infrastructure",
          vendor: "cloudflare",
          resource: "d1",
          unit: "d1_rows_read",
          quantity: 3,
          rates: [],
        }),
      ),
    ]);

    expect(publisher.usageChanged).toHaveBeenCalledTimes(1);
    expect(publisher.usageChanged).toHaveBeenCalledWith(7, "2026-08");
  });
});

describe("emitUsageEvents", () => {
  it("writes the ledger directly when there is no queue", async () => {
    const { store, runtime } = createFakeRuntime();

    await expect(emitUsageEvents(runtime, { drafts: [draft()] })).resolves.toBe("written");
    expect(store.insertEventAndApplyBalance).toHaveBeenCalledTimes(1);
  });

  it("queues a rollup when a queue is available", async () => {
    const enqueueRollup = vi.fn(async () => {});
    const { store, runtime } = createFakeRuntime({ enqueueRollup });

    await expect(emitUsageEvents(runtime, { drafts: [draft()] })).resolves.toBe("queued");
    expect(enqueueRollup).toHaveBeenCalledWith(
      { events: [expect.objectContaining({ user_id: 7 })] },
      7,
    );
    expect(store.insertEventAndApplyBalance).not.toHaveBeenCalled();
  });

  it("falls back to a direct write when enqueueing fails rather than losing the event", async () => {
    const { store, runtime } = createFakeRuntime({
      enqueueRollup: async () => {
        throw new Error("queue unavailable");
      },
    });

    await expect(emitUsageEvents(runtime, { drafts: [draft()] })).resolves.toBe("written");
    expect(store.insertEventAndApplyBalance).toHaveBeenCalledTimes(1);
  });

  it("writes inline deliveries straight to the ledger without queueing", async () => {
    const enqueueRollup = vi.fn(async () => {});
    const { store, runtime } = createFakeRuntime({ enqueueRollup });

    await expect(emitUsageEvents(runtime, { drafts: [draft()], delivery: "inline" })).resolves.toBe(
      "written",
    );
    expect(enqueueRollup).not.toHaveBeenCalled();
    expect(store.insertEventAndApplyBalance).toHaveBeenCalledTimes(1);
  });

  it("commits anonymous spend against the anonymous balance without a ledger row", async () => {
    const { store, runtime } = createFakeRuntime();

    await expect(
      emitUsageEvents(runtime, {
        drafts: [draft({ actor: { kind: "anonymous", anonymousUserId: "anon-1" } })],
      }),
    ).resolves.toBe("written");
    expect(store.applyAnonymousCreditDeltas).toHaveBeenCalledWith("anon-1", "2026-08", {
      spent_credit_micros: 500_000,
    });
    expect(store.insertEventAndApplyBalance).not.toHaveBeenCalled();
  });

  it("never throws out of a billing path when the ledger is unwritable", async () => {
    const { store, runtime } = createFakeRuntime();

    store.insertEventAndApplyBalance.mockRejectedValue(new Error("d1 unavailable"));

    await expect(emitUsageEvents(runtime, { drafts: [draft()] })).resolves.toBe("failed");
  });
});
