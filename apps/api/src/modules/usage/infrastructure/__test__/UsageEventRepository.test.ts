import type { UsageEventRecord } from "@ngriffin_uk/polychat-ai-billing";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { UsageEventRepository } from "../UsageEventRepository";

function event(overrides: Partial<UsageEventRecord> = {}): UsageEventRecord {
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
    vendor_units: null,
    reason: null,
    site: null,
    raw: null,
    ...overrides,
  };
}

describe("UsageEventRepository.insertEventAndApplyBalance", () => {
  let sqlite: Database.Database;

  function execute(query: string, params: unknown[]) {
    const statement = sqlite.prepare(query);
    const info = statement.run(...params);

    return { success: true, meta: { changes: info.changes } };
  }

  function createEnv(): IEnv {
    const prepare = (query: string) => ({
      bind: (...params: unknown[]) => ({
        query,
        params,
        run: async () => execute(query, params),
      }),
    });
    const batch = async (statements: Array<{ query: string; params: unknown[] }>) =>
      sqlite.transaction(() =>
        statements.map((statement) => execute(statement.query, statement.params)),
      )();

    return { DB: { prepare, batch } } as unknown as IEnv;
  }

  function readBalance() {
    return sqlite
      .prepare("SELECT * FROM usage_balance WHERE user_id = 7 AND period = '2026-09'")
      .get() as Record<string, number> | undefined;
  }

  function countEvents() {
    return (sqlite.prepare("SELECT COUNT(*) AS n FROM usage_event").get() as { n: number }).n;
  }

  const proSeed = {
    planId: "pro",
    includedCreditMicros: 500_000_000,
    graceCreditMicros: 50_000_000,
  };

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE usage_event (
        id text PRIMARY KEY, idempotency_key text NOT NULL UNIQUE, user_id integer,
        workspace_id text, project_id text, conversation_id text, message_id text,
        activity_id text, completion_id text, run_id text, run_attempt integer,
        occurred_at text, period text, source text, vendor text, resource text, unit text,
        quantity real, rate_version text, unit_cost_micros integer, cost_micros integer,
        credit_micros integer, billable integer, byok integer, estimated integer,
        vendor_units real, reason text, site text, raw text
      );
      CREATE TABLE usage_balance (
        id text PRIMARY KEY, user_id integer NOT NULL, period text NOT NULL, plan_id text,
        included_credit_micros integer DEFAULT 0 NOT NULL,
        grace_credit_micros integer DEFAULT 0 NOT NULL,
        spent_credit_micros integer DEFAULT 0 NOT NULL,
        overrun_credit_micros integer DEFAULT 0 NOT NULL,
        overage_credit_micros integer DEFAULT 0 NOT NULL,
        overage_enabled integer DEFAULT 0 NOT NULL,
        last_event_at text, updated_at text
      );
      CREATE UNIQUE INDEX usage_balance_user_period_idx ON usage_balance (user_id, period);
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("records the event and applies its spend once across replays", async () => {
    const repository = new UsageEventRepository(createEnv());

    await expect(repository.insertEventAndApplyBalance(event(), proSeed)).resolves.toBe(true);
    await expect(repository.insertEventAndApplyBalance(event(), proSeed)).resolves.toBe(false);

    expect(countEvents()).toBe(1);
    expect(readBalance()).toMatchObject({
      plan_id: "pro",
      included_credit_micros: 500_000_000,
      spent_credit_micros: 30_000,
    });
  });

  it("applies the spend on retry when the balance write failed the first time", async () => {
    const repository = new UsageEventRepository(createEnv());

    sqlite.exec(`
      CREATE TABLE fail_balance (flag integer);
      INSERT INTO fail_balance VALUES (1);
      CREATE TRIGGER fail_balance_update BEFORE UPDATE OF spent_credit_micros ON usage_balance
      WHEN EXISTS (SELECT 1 FROM fail_balance)
      BEGIN SELECT RAISE(ABORT, 'D1 busy'); END;
    `);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(repository.insertEventAndApplyBalance(event(), proSeed)).rejects.toThrow();
    expect(countEvents()).toBe(0);

    sqlite.exec("DELETE FROM fail_balance");

    await expect(repository.insertEventAndApplyBalance(event(), proSeed)).resolves.toBe(true);
    expect(readBalance()?.spent_credit_micros).toBe(30_000);
  });

  it("routes spend past the ceiling to overrun, or to overage when the user opted in", async () => {
    const repository = new UsageEventRepository(createEnv());
    const seed = { planId: "free", includedCreditMicros: 20_000, graceCreditMicros: 0 };

    await repository.insertEventAndApplyBalance(event(), seed);
    expect(readBalance()).toMatchObject({
      overrun_credit_micros: 10_000,
      overage_credit_micros: 0,
    });

    sqlite.exec("UPDATE usage_balance SET overage_enabled = 1");
    await repository.insertEventAndApplyBalance(
      event({ id: "event-2", idempotency_key: "model:message-2:input_tokens" }),
      seed,
    );
    expect(readBalance()).toMatchObject({
      spent_credit_micros: 60_000,
      overrun_credit_micros: 10_000,
      overage_credit_micros: 30_000,
    });
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
});
