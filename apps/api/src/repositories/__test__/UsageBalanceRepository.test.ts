import { describe, expect, it, vi } from "vitest";

import { UsageBalanceRepository } from "../UsageBalanceRepository";

function createRepository() {
  const statements: { query: string; values: unknown[] }[] = [];
  const prepare = vi.fn((query: string) => ({
    bind: (...values: unknown[]) => {
      statements.push({ query, values });

      return {
        run: async () => ({ success: true, meta: { changes: 1 } }),
        first: async () => null,
        all: async () => ({ results: [] }),
      };
    },
  }));

  return {
    statements,
    repository: new UsageBalanceRepository({ DB: { prepare } } as any),
  };
}

function normalise(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

describe("UsageBalanceRepository", () => {
  it("mutates every credit column additively rather than writing a read value back", async () => {
    const { repository, statements } = createRepository();

    await repository.applyDeltas({
      userId: 12,
      period: "2026-08",
      planId: "pro",
      deltas: { spent_credit_micros: 500_000, reserved_credit_micros: -250_000 },
      lastEventAt: "2026-08-31T12:00:00.000Z",
    });

    const update = statements.find((statement) => statement.query.includes("UPDATE usage_balance"));

    expect(normalise(update?.query ?? "")).toContain(
      "SET spent_credit_micros = spent_credit_micros + ?, reserved_credit_micros = reserved_credit_micros + ?",
    );
    expect(update?.values.slice(0, 2)).toEqual([500_000, -250_000]);
    expect(update?.values.slice(-2)).toEqual([12, "2026-08"]);
  });

  it("creates the period row without clobbering one another request already inserted", async () => {
    const { repository, statements } = createRepository();

    await repository.applyDeltas({
      userId: 12,
      period: "2026-08",
      includedCreditMicros: 500_000_000,
      graceCreditMicros: 50_000_000,
      deltas: { spent_credit_micros: 1 },
    });

    const insert = statements.find((statement) =>
      statement.query.includes("INSERT INTO usage_balance"),
    );

    expect(normalise(insert?.query ?? "")).toContain("ON CONFLICT (user_id, period) DO NOTHING");
    expect(insert?.values).toEqual(["12:2026-08", 12, "2026-08", null, 500_000_000, 50_000_000]);
  });

  it("writes nothing when every delta is zero", async () => {
    const { repository, statements } = createRepository();

    await repository.applyDeltas({
      userId: 12,
      period: "2026-08",
      deltas: { spent_credit_micros: 0 },
    });

    expect(statements).toHaveLength(0);
  });

  it("refuses a non-finite delta rather than corrupting the balance", async () => {
    const { repository } = createRepository();

    await expect(
      repository.applyDeltas({
        userId: 12,
        period: "2026-08",
        deltas: { spent_credit_micros: Number.NaN },
      }),
    ).rejects.toThrow();
  });
});
