import { describe, expect, it } from "vitest";

import { COMPUTER_SEEK_POLICY, type SeekStepAction } from "../seek-policy";

function answers(goalNoul: number, action: SeekStepAction, actionConfidence: number) {
  return {
    goal_reached: { type: "noul" as const, noul: goalNoul },
    next_action: {
      type: "choice" as const,
      choice: action,
      probabilities: { [action]: actionConfidence },
      confidence: actionConfidence,
    },
  };
}

describe("COMPUTER_SEEK_POLICY", () => {
  it("stops as soon as the page confidently shows the goal", () => {
    expect(COMPUTER_SEEK_POLICY.evaluate(answers(0.95, "scroll_down", 0.9)).outcome).toBe("done");
  });

  it("keeps reading while the goal is merely plausible", () => {
    expect(COMPUTER_SEEK_POLICY.evaluate(answers(0.7, "scroll_down", 0.8)).outcome).toBe(
      "scroll_down",
    );
    expect(COMPUTER_SEEK_POLICY.evaluate(answers(0.1, "wait", 0.75)).outcome).toBe("wait");
  });

  it("gives up rather than guessing when no step is clearly worth taking", () => {
    expect(COMPUTER_SEEK_POLICY.evaluate(answers(0.2, "scroll_down", 0.3)).outcome).toBe("blocked");
  });

  it("reports the goal probability on every outcome so callers can see why it stopped", () => {
    expect(COMPUTER_SEEK_POLICY.evaluate(answers(0.42, "scroll_up", 0.9)).metrics).toEqual({
      goalReached: 0.42,
    });
  });
});
