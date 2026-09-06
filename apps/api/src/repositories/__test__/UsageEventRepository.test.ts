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
    run_id: "run-1",
    run_attempt: 1,
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
  function harness(eventInserted: boolean) {
    const statements: Array<{ query: string; values: unknown[] }> = [];
    const runs: Array<{ query: string; values: unknown[] }> = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({
        query,
        values,
        run: async () => {
          runs.push({ query, values });

          return { success: true, meta: { changes: eventInserted ? 1 : 0 } };
        },
      }),
    }));
    const batch = vi.fn(async (bound: Array<{ query: string; values: unknown[] }>) => {
      statements.push(...bound);

      return bound.map(() => ({ success: true, meta: { changes: 1 } }));
    });

    return {
      statements,
      runs,
      batch,
      repository: new UsageEventRepository({ DB: { prepare, batch } } as never),
    };
  }

  const proSeed = {
    planId: "pro",
    includedCreditMicros: 500_000_000,
    graceCreditMicros: 50_000_000,
  };

  it("inserts the event first, then upserts the allowance and applies spend", async () => {
    const { repository, statements, runs } = harness(true);

    await expect(repository.insertEventAndApplyBalance(event(), proSeed)).resolves.toBe(true);

    expect(runs[0]?.query).toContain("INSERT INTO usage_event");
    expect(statements).toHaveLength(2);
    expect(statements[0]?.query).toContain("INSERT INTO usage_balance");
    expect(statements[0]?.query.replace(/\s+/g, " ")).toContain(
      "ON CONFLICT (user_id, period) DO UPDATE SET",
    );
    expect(statements[1]?.query.replace(/\s+/g, " ")).toContain(
      "spent_credit_micros = spent_credit_micros + ?",
    );
    expect(statements[1]?.values).toEqual([
      30_000,
      30_000,
      30_000,
      "2026-09-01T12:00:00.000Z",
      7,
      "2026-09",
    ]);
  });

  it("refreshes a stale allowance on an existing balance row", async () => {
    const { repository, statements } = harness(true);

    await repository.insertEventAndApplyBalance(event(), proSeed);

    const upsert = statements[0]?.query.replace(/\s+/g, " ") ?? "";

    expect(upsert).toContain("included_credit_micros = excluded.included_credit_micros");
    expect(upsert).toContain("grace_credit_micros = excluded.grace_credit_micros");
  });

  it("routes spend past the ceiling to overrun, or to overage when the user opted in", async () => {
    const { repository, statements } = harness(true);

    await repository.insertEventAndApplyBalance(event(), proSeed);

    const update = statements[1]?.query.replace(/\s+/g, " ") ?? "";

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
    const { repository, batch } = harness(false);

    await expect(repository.insertEventAndApplyBalance(event(), proSeed)).resolves.toBe(false);

    expect(batch).not.toHaveBeenCalled();
  });
});

describe("listUserEvents filtering", () => {
  function queryHarness() {
    const queries: Array<{ query: string; values: unknown[] }> = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({
        query,
        values,
        all: async () => {
          queries.push({ query, values });

          return { results: [] };
        },
      }),
    }));

    return {
      queries,
      repository: new UsageEventRepository({ DB: { prepare } } as never),
    };
  }

  it.each(["source", "vendor", "project"] as const)(
    "bounds workspace %s summaries to the saved attribution and period",
    async (dimension) => {
      const { repository, queries } = queryHarness();

      await repository.summariseWorkspacePeriodBy("workspace-1", "2026-09", dimension);
      expect(queries[0]?.query).toContain("WHERE workspace_id = ? AND period = ?");
      expect(queries[0]?.values).toEqual(["workspace-1", "2026-09"]);
      expect(queries[0]?.query).not.toContain("user_id =");
    },
  );

  it("filters by source and keeps the cursor bindings in order", async () => {
    const { repository, queries } = queryHarness();

    await repository.listUserEvents({
      userId: 7,
      period: "2026-09",
      limit: 10,
      source: "model",
      cursor: { occurredAt: "2026-09-01T00:00:00.000Z", id: "event-1" },
    });

    expect(queries[0]?.query.replace(/\s+/g, " ")).toContain("AND source = ?");
    expect(queries[0]?.values).toEqual([
      7,
      "2026-09",
      "model",
      "2026-09-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
      "event-1",
      10,
    ]);
  });

  it("omits the source clause when no filter is given", async () => {
    const { repository, queries } = queryHarness();

    await repository.listUserEvents({ userId: 7, period: "2026-09", limit: 10 });

    expect(queries[0]?.query).not.toContain("source = ?");
    expect(queries[0]?.values).toEqual([7, "2026-09", 10]);
  });
});
