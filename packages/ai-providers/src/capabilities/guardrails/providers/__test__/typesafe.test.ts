import type { DecisionResponse } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ProviderRuntime } from "../../../../runtime.js";
import { evaluateTypeSafeGuardrail, TypeSafeGuardProvider } from "../typesafe.js";

function response(
  nouls: Partial<
    Record<"jailbreak" | "harmful_activity" | "medical_decision" | "self_harm", number>
  >,
  severity = 0,
): DecisionResponse {
  const noul = (value: number | undefined) => ({ type: "noul" as const, noul: value ?? 0 });

  return {
    provider: "typesafe",
    model: "jev-latest",
    answers: {
      jailbreak: noul(nouls.jailbreak),
      harmful_activity: noul(nouls.harmful_activity),
      medical_decision: noul(nouls.medical_decision),
      self_harm: noul(nouls.self_harm),
      severity: {
        type: "score",
        score: severity,
        legend: { "0": "none", "1": "minor", "2": "serious", "3": "severe" },
        probabilities: {},
        confidence: 1,
      },
    },
    usage: { input_tokens: 10, output_tokens: 1 },
  };
}

const thresholds = { blockThreshold: 0.7, severityBlockLevel: 2 };

describe("evaluateTypeSafeGuardrail", () => {
  it("passes ordinary content", () => {
    const result = evaluateTypeSafeGuardrail(
      response({ jailbreak: 0.02 }, 0.1),
      "INPUT",
      thresholds,
    );

    expect(result).toMatchObject({ provider: "typesafe", isValid: true, violations: [] });
  });

  it("names every hazard over the block threshold", () => {
    const result = evaluateTypeSafeGuardrail(
      response({ jailbreak: 0.91, harmful_activity: 0.75, self_harm: 0.3 }, 2.5),
      "INPUT",
      thresholds,
    );

    expect(result.isValid).toBe(false);
    expect(result.violations).toEqual(["jailbreak", "harmful_activity"]);
  });

  it("blocks on severity alone when no single hazard is confident", () => {
    const result = evaluateTypeSafeGuardrail(
      response({ harmful_activity: 0.4, medical_decision: 0.5 }, 2.2),
      "OUTPUT",
      thresholds,
    );

    expect(result.violations).toEqual(["unsafe_response"]);
  });
});

describe("TypeSafeGuardProvider", () => {
  it("sends the message and prompt as state and applies configured thresholds", async () => {
    const decide = vi.fn(async (_request: unknown) => response({ medical_decision: 0.55 }, 1));
    const resolve = vi.fn(() => ({ name: "typesafe", decide }));
    const runtime: ProviderRuntime = {
      host: {
        models: {} as never,
        storage: { forEnv: () => null, forContext: () => null },
        keyStore: () => undefined,
      },
      providers: { resolve: resolve as never },
    };
    const env = { TYPESAFE_API_KEY: "k" };
    const provider = new TypeSafeGuardProvider({ env, blockThreshold: 0.5 }, runtime);

    const result = await provider.validateContent(
      { text: "take 40mg", prompt: "what dose?" },
      "OUTPUT",
    );

    expect(resolve).toHaveBeenCalledWith("decision", "typesafe", { env, user: undefined });
    expect(decide.mock.calls[0]?.[0]).toMatchObject({
      state: { prompt: "what dose?", message: "take 40mg" },
    });
    expect(result.violations).toEqual(["medical_decision"]);
  });

  it("rejects thresholds outside the unit interval", () => {
    const runtime = {} as ProviderRuntime;

    expect(() => new TypeSafeGuardProvider({ env: {}, blockThreshold: 1.5 }, runtime)).toThrow(
      "between 0 and 1",
    );
  });
});
