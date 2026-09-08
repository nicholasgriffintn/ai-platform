import { describe, expect, it } from "vitest";

import { chatRunSchema } from "./chat-runs.js";
import {
  DELEGATION_MAX_DEPTH,
  delegationRunEventTypeSchema,
  delegationSchema,
} from "./delegations.js";

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
  createdAt: "2026-09-08T10:00:00.000Z",
  updatedAt: "2026-09-08T10:00:00.000Z",
};

describe("delegationSchema", () => {
  it("round-trips a bounded delegation", () => {
    expect(delegationSchema.parse(delegation)).toEqual(delegation);
  });

  it("rejects a delegation beyond the depth cap", () => {
    expect(() =>
      delegationSchema.parse({ ...delegation, depth: DELEGATION_MAX_DEPTH + 1 }),
    ).toThrow();
  });

  it("recognises delegation run events", () => {
    expect(delegationRunEventTypeSchema.parse("delegation.created")).toBe("delegation.created");
  });

  it("defaults run triggers to user", () => {
    expect(chatRunSchema.shape.trigger.parse(undefined)).toBe("user");
  });
});
