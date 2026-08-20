import { describe, expect, it } from "vitest";

import {
  isPreemptiveInstruction,
  resolveNextInstruction,
  type ThreadInstruction,
  type ThreadInstructionKind,
} from "./thread-instructions";

function instruction(kind: ThreadInstructionKind, index: number): ThreadInstruction {
  return {
    kind,
    id: `instruction-${index}`,
    index,
    enqueuedAt: new Date(index * 1000).toISOString(),
  };
}

describe("resolveNextInstruction", () => {
  it("runs nothing on an empty queue", () => {
    expect(resolveNextInstruction({ status: "idle", queue: [] })).toEqual({
      next: null,
      reason: "empty",
    });
  });

  it("holds the thread while an operation is running", () => {
    expect(
      resolveNextInstruction({ status: "running", queue: [instruction("user_message", 1)] }),
    ).toMatchObject({ next: null, reason: "busy" });
  });

  it("runs the head of the queue when idle", () => {
    expect(
      resolveNextInstruction({
        status: "idle",
        queue: [instruction("user_message", 1), instruction("compact", 2)],
      }),
    ).toMatchObject({ next: { kind: "user_message" }, reason: "idle" });
  });

  it("lets cancel pre-empt work in flight", () => {
    expect(
      resolveNextInstruction({
        status: "running",
        queue: [instruction("user_message", 1), instruction("cancel", 2)],
      }),
    ).toMatchObject({ next: { kind: "cancel" }, reason: "preempt" });
  });

  it("drops a goal continuation when real user work is waiting behind it", () => {
    expect(
      resolveNextInstruction({
        status: "idle",
        queue: [instruction("goal_continuation", 1), instruction("user_message", 2)],
      }),
    ).toMatchObject({ next: null, reason: "superseded" });
  });

  it("runs a goal continuation when it is the only thing queued", () => {
    expect(
      resolveNextInstruction({
        status: "idle",
        queue: [instruction("goal_continuation", 1)],
      }),
    ).toMatchObject({ next: { kind: "goal_continuation" }, reason: "idle" });
  });

  it("serialises compaction behind a turn rather than racing it", () => {
    const queue = [instruction("compact", 1)];

    expect(resolveNextInstruction({ status: "running", queue })).toMatchObject({
      next: null,
      reason: "busy",
    });
    expect(resolveNextInstruction({ status: "idle", queue })).toMatchObject({
      next: { kind: "compact" },
    });
  });
});

describe("isPreemptiveInstruction", () => {
  it("treats only cancel as pre-emptive", () => {
    expect(isPreemptiveInstruction("cancel")).toBe(true);

    for (const kind of [
      "user_message",
      "goal_continuation",
      "compact",
      "goal_set",
      "goal_pause",
      "goal_resume",
      "goal_clear",
      "title",
    ] as ThreadInstructionKind[]) {
      expect(isPreemptiveInstruction(kind)).toBe(false);
    }
  });
});
