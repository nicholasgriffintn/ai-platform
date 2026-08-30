import { describe, expect, it } from "vitest";

import { parseGoalCommand, resolveGoalSubmission } from "./goal-command";
import { createGoalMarkerMessage, getGoalMessageMarker } from "./message-goal-status";

describe("parseGoalCommand", () => {
  it("reports status for a bare command, whatever the casing or padding", () => {
    expect(parseGoalCommand("/goal")).toEqual({ kind: "status" });
    expect(parseGoalCommand("  /GOAL  ")).toEqual({ kind: "status" });
  });

  it("reads the lifecycle subcommands", () => {
    expect(parseGoalCommand("/goal pause")).toEqual({ kind: "pause" });
    expect(parseGoalCommand("/goal Resume")).toEqual({ kind: "resume" });
    expect(parseGoalCommand("/goal clear")).toEqual({ kind: "clear" });
  });

  it("takes everything after the command as the objective", () => {
    expect(parseGoalCommand("/goal make the checkout suite pass")).toEqual({
      kind: "set",
      objective: "make the checkout suite pass",
    });
  });

  it("treats a reserved word as an objective when more words follow", () => {
    expect(parseGoalCommand("/goal pause the rollout until the error rate drops")).toEqual({
      kind: "set",
      objective: "pause the rollout until the error rate drops",
    });
  });

  it("preserves inner punctuation and spacing of the objective", () => {
    expect(parseGoalCommand("/goal reduce p95 below 120ms, without regressing tests")).toEqual({
      kind: "set",
      objective: "reduce p95 below 120ms, without regressing tests",
    });
  });

  it("ignores anything that is not the goal command", () => {
    expect(parseGoalCommand("/compact")).toBeNull();
    expect(parseGoalCommand("goal make it faster")).toBeNull();
    expect(parseGoalCommand("/goals make it faster")).toBeNull();
    expect(parseGoalCommand("")).toBeNull();
  });
});

describe("getGoalMessageMarker", () => {
  it("reads a persisted goal marker part", () => {
    expect(
      getGoalMessageMarker({
        role: "goal",
        content: "Goal set",
        parts: [
          { type: "goal", event: "set", label: "Goal set", objective: "Make the suite pass" },
        ],
      }),
    ).toEqual({ event: "set", label: "Goal set", objective: "Make the suite pass" });
  });

  it("falls back to the event label when none was stored", () => {
    expect(getGoalMessageMarker({ parts: [{ type: "goal", event: "stalled" }] })).toMatchObject({
      label: "Goal stopped making progress",
    });
  });

  it("ignores messages that are not goal markers", () => {
    expect(
      getGoalMessageMarker({ role: "assistant", parts: [{ type: "text", text: "hi" }] }),
    ).toBeNull();
    expect(getGoalMessageMarker(null)).toBeNull();
  });

  it("creates an optimistic marker with the shared start label", () => {
    const message = createGoalMarkerMessage({
      event: "set",
      objective: "Make the suite pass",
      id: "goal-marker-1",
      timestamp: 123,
    });

    expect(message).toMatchObject({
      id: "goal-marker-1",
      role: "goal",
      content: "Goal started",
      timestamp: 123,
    });
    expect(getGoalMessageMarker(message)).toEqual({
      event: "set",
      label: "Goal started",
      objective: "Make the suite pass",
    });
  });
});

describe("resolveGoalSubmission", () => {
  it("sets the goal and sends the objective as the message while composing", () => {
    expect(resolveGoalSubmission({ input: "count to 100 in tens", isComposingGoal: true })).toEqual(
      {
        command: { kind: "set", objective: "count to 100 in tens" },
        messageInput: "count to 100 in tens",
      },
    );
  });

  it("sends the objective for a typed set command without the command prefix", () => {
    expect(resolveGoalSubmission({ input: "/goal count to 100", isComposingGoal: false })).toEqual({
      command: { kind: "set", objective: "count to 100" },
      messageInput: "count to 100",
    });
  });

  it("keeps subcommands and status off the wire as messages", () => {
    for (const input of ["/goal", "/goal pause", "/goal resume", "/goal clear"]) {
      expect(resolveGoalSubmission({ input, isComposingGoal: false }).messageInput).toBeNull();
    }
  });

  it("leaves an ordinary message untouched", () => {
    expect(resolveGoalSubmission({ input: "hello there", isComposingGoal: false })).toEqual({
      command: null,
      messageInput: "hello there",
    });
  });

  it("does not treat an empty composer as an objective", () => {
    expect(resolveGoalSubmission({ input: "   ", isComposingGoal: true })).toEqual({
      command: null,
      messageInput: "   ",
    });
  });
});
