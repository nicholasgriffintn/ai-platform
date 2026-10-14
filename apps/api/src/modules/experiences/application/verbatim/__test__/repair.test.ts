import { describe, expect, it } from "vitest";

import { KEEP_CANDIDATE_ID, applyRepair, planRepair } from "../repair";

const words = ["thanks", "for", "for", "watching", "everyone"];

describe("Verbatim repair", () => {
  it("offers nothing to repair when every word was heard", () => {
    expect(planRepair(words, [0.9, 0.8, 0.7, 0.95, 0.6])).toBeNull();
  });

  it("proposes dropping each inaudible word, all of them together, and never a duplicate", () => {
    const plan = planRepair(words, [0.9, 0.1, 0.2, 0.95, 0.05]);

    expect(plan?.candidates).toEqual({
      [KEEP_CANDIDATE_ID]: "thanks for for watching everyone",
      drop_4: "thanks for for watching",
      drop_1: "thanks for watching everyone",
      drop_all: "thanks watching",
    });
  });

  it("strikes words only when the model clearly prefers the shorter transcript", () => {
    const probabilities = [0.9, 0.1, 0.9, 0.95, 0.9];
    const plan = planRepair(words, probabilities);

    if (!plan) {
      throw new Error("expected a repair plan");
    }

    const confident = applyRepair(words, probabilities, plan, {
      choice: "drop_1",
      probabilities: { [KEEP_CANDIDATE_ID]: 0.2, drop_1: 0.8 },
    });
    const hesitant = applyRepair(words, probabilities, plan, {
      choice: "drop_1",
      probabilities: { [KEEP_CANDIDATE_ID]: 0.45, drop_1: 0.55 },
    });

    expect(confident.repair.applied).toBe(true);
    expect(confident.words.map((word) => word.removed)).toEqual([false, true, false, false, false]);
    expect(hesitant.repair.applied).toBe(false);
    expect(hesitant.words.some((word) => word.removed)).toBe(false);
  });
});
