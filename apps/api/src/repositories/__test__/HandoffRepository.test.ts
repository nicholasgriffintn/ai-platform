import { describe, expect, it, vi } from "vitest";

import { HandoffRepository } from "../HandoffRepository";

function createRepository(changes: number) {
  const queries: string[] = [];
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes } });
  const first = vi.fn().mockResolvedValue(null);
  const prepare = vi.fn((query: string) => {
    queries.push(query);

    return { bind: vi.fn(() => ({ run, first })) };
  });

  return { queries, repository: new HandoffRepository({ DB: { prepare } } as any) };
}

describe("HandoffRepository", () => {
  it("claims only a pending handoff addressed to the claiming machine", async () => {
    const { queries, repository } = createRepository(0);

    await expect(repository.claim("handoff-1", "machine-1")).resolves.toBeNull();
    expect(queries.some((query) => query.includes("state = 'pending'"))).toBe(true);
    expect(queries.some((query) => query.includes("machine_id = ?"))).toBe(true);
  });

  it("reports a decision that changed nothing", async () => {
    const { repository } = createRepository(0);

    await expect(repository.decide("handoff-1", "machine-1", "running")).resolves.toBe(false);
  });

  it("reports a decision the claiming machine was allowed to make", async () => {
    const { queries, repository } = createRepository(1);

    await expect(repository.decide("handoff-1", "machine-1", "done")).resolves.toBe(true);
    expect(queries[0]).toContain("claimed_by = ?");
    expect(queries[0]).toContain("state IN ('claimed', 'running')");
  });
});
