import { describe, expect, it, vi } from "vitest";

import { DelegationRepository } from "../DelegationRepository";

const row = {
  id: "delegation-1",
  parent_conversation_id: "conversation-1",
  child_conversation_id: "delegate_delegation-1",
  parent_run_id: "run-1",
  depth: 1,
  teammate_id: "teammate-1",
  goal: "Review the change",
  wait_for: "all",
  max_credit_micros: 100_000,
  max_steps: 10,
  deadline: "2026-09-08T12:00:00.000Z",
  state: "queued",
  result_json: null,
  created_at: "2026-09-08T11:00:00.000Z",
  updated_at: "2026-09-08T11:00:00.000Z",
} as const;

describe("DelegationRepository", () => {
  it("persists and formats a queued delegation", async () => {
    const first = vi.fn().mockResolvedValue(row);
    const prepare = vi.fn((query: string) => ({
      bind: vi.fn(() => ({ first })),
      query,
    }));
    const repository = new DelegationRepository({ DB: { prepare } } as any);

    const delegation = await repository.createDelegation({
      id: row.id,
      parentConversationId: row.parent_conversation_id,
      childConversationId: row.child_conversation_id,
      parentRunId: row.parent_run_id,
      depth: row.depth,
      teammateId: row.teammate_id,
      goal: row.goal,
      waitFor: row.wait_for,
      budget: {
        maxCreditMicros: row.max_credit_micros,
        maxSteps: row.max_steps,
        deadline: row.deadline,
      },
    });

    expect(delegation).toMatchObject({
      id: row.id,
      childConversationId: row.child_conversation_id,
      state: "queued",
      result: null,
    });
    expect(prepare.mock.calls[0]?.[0]).toContain("INSERT INTO delegation");
  });
});
