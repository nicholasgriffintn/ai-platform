import { describe, expect, it } from "vitest";

import { createDecisionPolicyFunctions, defineDecisionPolicy } from "../decision-policy.js";
import { choice, noul } from "../questions.js";

const policy = defineDecisionPolicy({
  key: "test.urgency",
  version: "1",
  questions: {
    urgency: choice("How urgent?", ["critical", "high", "normal", "low"]),
    must_act: noul("Must the owner act?"),
  },
  evaluate: (answers) => ({
    outcome: answers.urgency.choice,
    confidence: answers.urgency.probabilities[answers.urgency.choice] ?? 0,
    reason: "judged",
  }),
});

function functionsAnswering(answers: Record<string, unknown>) {
  return createDecisionPolicyFunctions({
    tryDecide: async () =>
      ({ answers, provider: "test", model: "test-model", usage: undefined }) as never,
  });
}

describe("evaluateDecisionPolicy receipts", () => {
  it("keeps the options the judgement weighed but did not choose", async () => {
    const result = await functionsAnswering({
      urgency: {
        type: "choice",
        choice: "normal",
        probabilities: { critical: 0.01, high: 0.22, normal: 0.71, low: 0.06 },
        confidence: 0.71,
      },
      must_act: { type: "noul", noul: 0.4, confidence: 0.2 },
    }).evaluateDecisionPolicy({ env: {}, state: {}, policy, fallback: "normal" });

    expect(result.receipt.alternatives).toEqual([
      { question: "urgency", option: "high", probability: 0.22 },
      { question: "urgency", option: "low", probability: 0.06 },
    ]);
  });
});
