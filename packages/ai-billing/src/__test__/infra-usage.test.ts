import { describe, expect, it } from "vitest";

import { aggregateInfraUsage, type QueuedInfraUsage } from "../usage/infra-usage.js";

function usage(scopeKey: string, overrides: Partial<QueuedInfraUsage> = {}): QueuedInfraUsage {
  return {
    userId: 1,
    scopeKey,
    occurredAt: "2026-11-03T12:00:00.000Z",
    quantities: [{ unit: "d1_rows_read", quantity: 40 }],
    ...overrides,
  };
}

describe("aggregateInfraUsage", () => {
  it("gives the same batch the same key whatever order it is delivered in", async () => {
    const [forward] = await aggregateInfraUsage([usage("a"), usage("b")]);
    const [reversed] = await aggregateInfraUsage([usage("b"), usage("a")]);

    expect(forward?.scopeKey).toBe(reversed?.scopeKey);
    expect(forward?.quantities).toEqual([{ unit: "d1_rows_read", quantity: 80 }]);
  });

  it("keeps a lone request's key so a redelivery still deduplicates", async () => {
    const [single] = await aggregateInfraUsage([usage("request-1")]);

    expect(single?.scopeKey).toBe("request-1");
  });

  it("counts a request delivered twice in one batch once", async () => {
    const [merged] = await aggregateInfraUsage([usage("request-1"), usage("request-1")]);

    expect(merged?.quantities).toEqual([{ unit: "d1_rows_read", quantity: 40 }]);
  });

  it("keeps days apart so usage lands in the right period", async () => {
    const merged = await aggregateInfraUsage([
      usage("october", { occurredAt: "2026-10-31T23:59:59.000Z" }),
      usage("november", { occurredAt: "2026-11-01T00:00:01.000Z" }),
    ]);

    expect(merged.map((entry) => entry.occurredAt)).toEqual([
      "2026-10-31T23:59:59.000Z",
      "2026-11-01T00:00:01.000Z",
    ]);
  });
});
