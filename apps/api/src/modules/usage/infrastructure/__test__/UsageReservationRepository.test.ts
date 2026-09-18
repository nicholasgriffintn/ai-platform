import { describe, expect, it, vi } from "vitest";

import { UsageReservationRepository } from "../UsageReservationRepository";

function createDatabase(results: unknown[]) {
  const statements: Array<{ query: string; values: unknown[] }> = [];
  const prepare = vi.fn((query: string) => ({
    bind: (...values: unknown[]) => {
      const statement = { query, values };

      statements.push(statement);

      return statement;
    },
  }));
  const batch = vi.fn().mockResolvedValue(results);

  return { database: { prepare, batch }, statements, batch };
}

describe("UsageReservationRepository durable chat reservations", () => {
  it("holds the reservation and balance in one atomic batch", async () => {
    const { database, statements, batch } = createDatabase([
      { success: true, meta: { changes: 0 }, results: [] },
      { success: true, meta: { changes: 1 }, results: [] },
      { success: true, meta: { changes: 1 }, results: [] },
    ]);
    const repository = new UsageReservationRepository({ DB: database } as any);

    await expect(
      repository.createUserReservationWithBalance({
        id: "chat_run:run-1",
        userId: 7,
        period: "2026-09",
        kind: "chat_run",
        refId: "run-1",
        creditMicros: 1000,
        planId: "pro",
        includedCreditMicros: 10_000,
        graceCreditMicros: 5_000,
      }),
    ).resolves.toBe(true);

    expect(batch).toHaveBeenCalledOnce();
    expect(statements).toHaveLength(3);
    expect(statements[2]?.query).toContain("WHERE id = ? AND status = 'held'");
    expect(statements[2]?.values).toEqual([1000, 7, "2026-09", "chat_run:run-1"]);
  });

  it("releases the reservation and balance exactly once in one atomic batch", async () => {
    const released = {
      id: "chat_run:run-1",
      kind: "chat_run",
      ref_id: "run-1",
      status: "released",
    };
    const { database, statements, batch } = createDatabase([
      { success: true, meta: { changes: 1 }, results: [] },
      { success: true, meta: { changes: 1 }, results: [] },
      { success: true, meta: { changes: 1 }, results: [released] },
    ]);
    const repository = new UsageReservationRepository({ DB: database } as any);

    await expect(
      repository.finishUserReservationWithBalance("chat_run", "run-1", "released"),
    ).resolves.toEqual(released);

    expect(batch).toHaveBeenCalledOnce();
    expect(statements).toHaveLength(3);
    expect(statements[0]?.query).toContain("status = 'releasing'");
    expect(statements[1]?.query).toContain("reserved_credit_micros - COALESCE");
    expect(statements[2]?.query).toContain("status = 'releasing'");
  });
});
