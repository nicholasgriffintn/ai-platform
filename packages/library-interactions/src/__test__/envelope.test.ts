import { humanInTheLoopSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  expireHumanInTheLoop,
  mergeHumanInTheLoop,
  pendingApproval,
  pendingQuestion,
  pendingSelection,
  pendingTakeover,
  resolveHumanInTheLoop,
} from "../envelope.js";

describe("pending builders", () => {
  it("produce envelopes the canonical schema accepts", () => {
    const envelopes = [
      pendingApproval(),
      pendingApproval({ interactionId: "call-1", toolName: "delegate" }),
      pendingApproval({ message: "Deploy?", options: ["Approve", "Reject"] }),
      pendingQuestion({
        interactionId: "ask-1",
        questions: [{ id: "name", prompt: "What name?", options: [], allowOther: true }],
      }),
      pendingSelection(),
      pendingTakeover({ interactionId: "call-2", toolName: "use_computer" }),
    ];

    for (const envelope of envelopes) {
      expect(humanInTheLoopSchema.safeParse(envelope).success).toBe(true);
    }
  });

  it("carry the pending identity and action flag", () => {
    expect(pendingTakeover({ interactionId: "call-2", toolName: "use_computer" })).toEqual({
      type: "takeover",
      status: "pending",
      requires_user_action: true,
      interactionId: "call-2",
      toolName: "use_computer",
    });
  });
});

describe("mergeHumanInTheLoop", () => {
  it("preserves unknown envelope fields and applies the patch", () => {
    const merged = mergeHumanInTheLoop(
      { type: "approval", status: "pending", interactionId: "call-1", futureField: true },
      { status: "resolved", resolution: "approved", requires_user_action: false },
    );

    expect(merged).toEqual({
      type: "approval",
      status: "resolved",
      interactionId: "call-1",
      futureField: true,
      resolution: "approved",
      requires_user_action: false,
    });
  });

  it("starts from an empty envelope when the previous value is missing", () => {
    expect(mergeHumanInTheLoop(undefined, { status: "resolved" })).toEqual({ status: "resolved" });
  });

  it("resolve and expire set the terminal status and clear the action flag", () => {
    expect(resolveHumanInTheLoop({ type: "question", status: "pending" })).toEqual({
      type: "question",
      status: "resolved",
      requires_user_action: false,
    });
    expect(expireHumanInTheLoop({ type: "approval", status: "pending" })).toEqual({
      type: "approval",
      status: "expired",
      requires_user_action: false,
    });
  });
});
