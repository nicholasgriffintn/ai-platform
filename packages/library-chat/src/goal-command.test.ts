import { describe, expect, it } from "vitest";

import { parseGoalCommand } from "./goal-command";
import { getGoalMessageMarker } from "./message-goal-status";

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
    ).toEqual({ label: "Goal set", objective: "Make the suite pass" });
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
});
