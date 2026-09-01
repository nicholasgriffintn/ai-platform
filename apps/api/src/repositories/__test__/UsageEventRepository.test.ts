import { describe, expect, it, vi } from "vitest";

import { UsageEventRepository, type UsageEventInsert } from "../UsageEventRepository";

function event(overrides: Partial<UsageEventInsert> = {}): UsageEventInsert {
  return {
    id: "event-1",
    idempotency_key: "model:message-1:input_tokens",
    user_id: 7,
    workspace_id: null,
    project_id: null,
    conversation_id: "conversation-1",
    message_id: "message-1",
    activity_id: null,
    completion_id: "conversation-1",
    occurred_at: "2026-09-01T12:00:00.000Z",
    period: "2026-09",
    source: "model",
    vendor: "anthropic",
    resource: "claude-sonnet",
    unit: "input_tokens",
    quantity: 100,
    rate_version: "2026-01-01",
    unit_cost_micros: 3,
    cost_micros: 300,
    credit_micros: 30_000,
    billable: true,
    byok: false,
    estimated: false,
    raw: null,
    ...overrides,
  };
}

describe("UsageEventRepository", () => {
  it("inserts a billable event and applies its balance in one D1 batch", async () => {
    const statements: Array<{ query: string; values: unknown[] }> = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({ query, values }),
    }));
    const batch = vi.fn(async (bound: Array<{ query: string; values: unknown[] }>) => {
      statements.push(...bound);

      return [
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ];
    });
    const repository = new UsageEventRepository({ DB: { prepare, batch } } as never);

    await expect(
      repository.insertEventAndApplyBalance(event(), {
        planId: "pro",
        includedCreditMicros: 500_000_000,
        graceCreditMicros: 50_000_000,
      }),
    ).resolves.toBe(true);

    expect(statements).toHaveLength(3);
    expect(statements[0]?.query).toContain("INSERT INTO usage_balance");
    expect(statements[1]?.query).toContain("INSERT INTO usage_event");
    expect(statements[2]?.query.replace(/\s+/g, " ")).toContain(
      "spent_credit_micros = spent_credit_micros + ?",
    );
    expect(statements[2]?.query).toContain("changes() = 1");
    expect(statements[2]?.values).toEqual([
      30_000,
      30_000,
      30_000,
      "2026-09-01T12:00:00.000Z",
      7,
      "2026-09",
    ]);
  });

  it("routes spend past the ceiling to overrun, or to overage when the user opted in", async () => {
    const statements: Array<{ query: string; values: unknown[] }> = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({ query, values }),
    }));
    const batch = vi.fn(async (bound: Array<{ query: string; values: unknown[] }>) => {
      statements.push(...bound);

      return [
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ];
    });
    const repository = new UsageEventRepository({ DB: { prepare, batch } } as never);

    await repository.insertEventAndApplyBalance(event(), {
      planId: "pro",
      includedCreditMicros: 500_000_000,
      graceCreditMicros: 50_000_000,
    });

    const update = statements[2]?.query.replace(/\s+/g, " ") ?? "";

    expect(update).toContain(
      "overrun_credit_micros = overrun_credit_micros + CASE WHEN included_credit_micros > 0 AND overage_enabled = 0",
    );
    expect(update).toContain(
      "overage_credit_micros = overage_credit_micros + CASE WHEN included_credit_micros > 0 AND overage_enabled = 1",
    );
    expect(update).toContain(
      "MAX(0, spent_credit_micros + ? - MAX(spent_credit_micros, included_credit_micros + grace_credit_micros))",
    );
  });

  it("reports a replay without moving the balance", async () => {
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({ query, values }),
    }));
    const batch = vi.fn(async () => [
      { success: true, meta: { changes: 0 } },
      { success: true, meta: { changes: 0 } },
      { success: true, meta: { changes: 0 } },
    ]);
    const repository = new UsageEventRepository({ DB: { prepare, batch } } as never);

    await expect(
      repository.insertEventAndApplyBalance(event(), {
        planId: "pro",
        includedCreditMicros: 0,
        graceCreditMicros: 0,
      }),
    ).resolves.toBe(false);
  });
});
