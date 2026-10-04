import { describe, expect, it } from "vitest";

import { DELEGATION_MAX_DEPTH, delegationSchema } from "./delegations.js";

const delegation = {
  id: "delegation-1",
  parentConversationId: "conversation-1",
  childConversationId: "delegate_delegation-1",
  parentRunId: "run-1",
  depth: 1,
  teammateId: "teammate-1",
  goal: "Review the change",
  waitFor: "all" as const,
  budget: {
    maxCreditMicros: 100_000,
    maxSteps: 10,
    deadline: "2026-09-08T12:00:00.000Z",
  },
  state: "queued" as const,
  result: null,
  memoryBindings: [],
  continuationMode: "new" as const,
  createdAt: "2026-09-08T10:00:00.000Z",
  updatedAt: "2026-09-08T10:00:00.000Z",
};

describe("delegationSchema", () => {
  it("rejects a delegation beyond the depth cap", () => {
    expect(() =>
      delegationSchema.parse({
        ...delegation,
        depth: DELEGATION_MAX_DEPTH + 1,
      }),
    ).toThrow();
  });
});
