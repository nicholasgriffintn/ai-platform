import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, Message } from "~/types";

const { record } = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock("~/modules/decisions/infrastructure/DecisionFeedbackRepository", () => ({
  DecisionFeedbackRepository: class {
    record = record;
  },
}));

import { findEscalationDecision, recordToolIntentCorrection } from "../intent-corrections";

const env = { DB: {} } as unknown as IEnv;
const user = { id: 7 } as never;

function approvalMessage(toolCallId: string, decision?: unknown): Message {
  return {
    role: "tool",
    name: "send_email",
    content: "needs approval",
    data: { approval: { toolCallId, toolName: "send_email", ...(decision ? { decision } : {}) } },
  };
}

const tag = { key: "tool-intent", version: "1", recommended: "require_approval" };

describe("findEscalationDecision", () => {
  it("finds the policy that escalated this exact call", () => {
    expect(
      findEscalationDecision(
        [approvalMessage("other", tag), approvalMessage("call-1", tag)],
        "call-1",
      ),
    ).toEqual(tag);
  });

  it("returns nothing when the approval came from somewhere other than a policy", () => {
    expect(findEscalationDecision([approvalMessage("call-1")], "call-1")).toBeNull();
    expect(findEscalationDecision([approvalMessage("call-1", { key: "x" })], "call-1")).toBeNull();
  });
});

describe("recordToolIntentCorrection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the override when a person allows what the policy escalated", async () => {
    await expect(
      recordToolIntentCorrection({
        env,
        user,
        loadMessages: () => [approvalMessage("call-1", tag)],
        toolCallId: "call-1",
        toolName: "send_email",
        chosen: "allow",
      }),
    ).resolves.toBe(true);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        policyKey: "tool-intent",
        policyVersion: "1",
        recommended: "require_approval",
        corrected: "allow",
        userId: 7,
      }),
    );
  });

  it("records nothing for an approval the policy never asked for", async () => {
    await expect(
      recordToolIntentCorrection({
        env,
        user,
        loadMessages: () => [approvalMessage("call-1")],
        toolCallId: "call-1",
        toolName: "send_email",
        chosen: "allow",
      }),
    ).resolves.toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it("records nothing when the person agreed with the policy", async () => {
    await expect(
      recordToolIntentCorrection({
        env,
        user,
        loadMessages: () => [approvalMessage("call-1", { ...tag, recommended: "allow" })],
        toolCallId: "call-1",
        toolName: "send_email",
        chosen: "allow",
      }),
    ).resolves.toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it("never attributes a correction to an anonymous session", async () => {
    await expect(
      recordToolIntentCorrection({
        env,
        loadMessages: () => [approvalMessage("call-1", tag)],
        toolCallId: "call-1",
        toolName: "send_email",
        chosen: "allow",
      }),
    ).resolves.toBe(false);
    expect(record).not.toHaveBeenCalled();
  });
});
