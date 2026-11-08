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

  it("counts a request delivered twice in one batch once", async () => {
    const [merged] = await aggregateInfraUsage([usage("request-1"), usage("request-1")]);

    expect(merged?.quantities).toEqual([{ unit: "d1_rows_read", quantity: 40 }]);
  });
});
