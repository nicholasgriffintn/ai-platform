import { describe, expect, it } from "vitest";

import { estimateRunCreditMicros, estimateTurnCreditMicros } from "../turn-estimate.js";

const modelConfig = { costPer1kInputTokens: 0.003, costPer1kOutputTokens: 0.015, maxTokens: 8192 };

describe("estimateRunCreditMicros", () => {
  it("keeps a single-step run to one step", () => {
    const estimate = estimateRunCreditMicros({
      promptTokens: 2000,
      modelConfig,
      maxSteps: 20,
      multiStep: false,
    });

    expect(estimate.likelySteps).toBe(1);
    expect(estimate.likelyCreditMicros).toBeLessThan(estimate.stepCreditMicros);
  });

  it("orders likely below the ceiling, and grows with context across steps", () => {
    const estimate = estimateRunCreditMicros({
      promptTokens: 2000,
      modelConfig,
      maxSteps: 20,
      multiStep: true,
    });
    const flatSteps = 20 * estimateTurnCreditMicros({ promptTokens: 2000, modelConfig });

    expect(estimate.likelySteps).toBe(4);
    expect(estimate.likelyCreditMicros).toBeLessThan(estimate.ceilingCreditMicros);
    expect(estimate.ceilingCreditMicros).toBeGreaterThan(flatSteps);
  });

  it("never plans more likely steps than the step budget allows", () => {
    expect(
      estimateRunCreditMicros({ promptTokens: 100, modelConfig, maxSteps: 2, multiStep: true })
        .likelySteps,
    ).toBe(2);
  });

  it("reports nothing for a model with no rates rather than guessing", () => {
    expect(
      estimateRunCreditMicros({ promptTokens: 100, maxSteps: 5, multiStep: true })
        .ceilingCreditMicros,
    ).toBe(0);
  });
});
