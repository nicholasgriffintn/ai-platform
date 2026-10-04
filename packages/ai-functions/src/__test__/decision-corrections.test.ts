import type { DecisionCorrection, DecisionState } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createDecisionPolicyFunctions } from "../decision-policy.js";
import { noul } from "../questions.js";

const corrections: DecisionCorrection[] = [
  { recommended: "require_approval", corrected: "allow", summary: "Sent a draft" },
];

const answer = {
  provider: "typesafe",
  model: "jev-latest",
  answers: { ok: { type: "noul", noul: 0.9 } },
  usage: { input_tokens: 1, output_tokens: 1 },
};

function policy(
  calibrate?: (state: DecisionState, seen: readonly DecisionCorrection[]) => DecisionState,
) {
  return {
    key: "test",
    version: "1",
    questions: { ok: noul("Is it fine?") },
    evaluate: () => ({ outcome: "allow" as const, confidence: 1, reason: "fine" }),
    ...(calibrate ? { calibrate } : {}),
  };
}

type DecideMock = ReturnType<typeof vi.fn> & {
  mock: { calls: Array<[{ state: DecisionState }]> };
};

function evaluator(tryDecide: DecideMock) {
  return createDecisionPolicyFunctions({ tryDecide } as never).evaluateDecisionPolicy;
}

function sentState(tryDecide: DecideMock): DecisionState {
  const call = tryDecide.mock.calls[0];

  if (!call) {
    throw new Error("the decision model was never called");
  }

  return call[0].state;
}

describe("decision policy calibration", () => {
  it("sends the state untouched when a policy declares no calibration", async () => {
    const tryDecide = vi.fn(async () => answer) as unknown as DecideMock;
    const state = { request: "send it" };

    await evaluator(tryDecide)({
      env: {},
      state,
      policy: policy(),
      fallback: "deny",
      corrections,
    });

    expect(sentState(tryDecide)).toBe(state);
  });

  it("lets a policy fold corrections into a shape it owns", async () => {
    const tryDecide = vi.fn(async () => answer) as unknown as DecideMock;

    await evaluator(tryDecide)({
      env: {},
      state: { request: "send it" },
      policy: policy((state, seen) => ({
        ...(state as Record<string, unknown>),
        priorDecisions: seen.map((correction) => correction.corrected),
      })),
      fallback: "deny",
      corrections,
    });

    expect(sentState(tryDecide)).toEqual({
      request: "send it",
      priorDecisions: ["allow"],
    });
  });

  it("never calls calibration when there is nothing to learn from", async () => {
    const tryDecide = vi.fn(async () => answer) as unknown as DecideMock;
    const calibrate = vi.fn((state: DecisionState) => state);

    await evaluator(tryDecide)({
      env: {},
      state: "plain text",
      policy: policy(calibrate),
      fallback: "deny",
      corrections: [],
    });

    expect(calibrate).not.toHaveBeenCalled();
    expect(sentState(tryDecide)).toBe("plain text");
  });
});
