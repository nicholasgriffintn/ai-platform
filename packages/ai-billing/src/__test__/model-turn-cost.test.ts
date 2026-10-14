import type { NormalisedTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { priceModelTurnUsage } from "../usage/model-turn-cost";

function model(provider: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    provider,
    matchingModel: "test-model",
    name: "Test model",
    costPer1kInputTokens: 0.001,
    costPer1kOutputTokens: 0.002,
    ...overrides,
  };
}

function usage(inputTokens: number, outputTokens: number): NormalisedTokenUsage {
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };
}

describe("priceModelTurnUsage", () => {
  it("prices the turn from the model's rates when the provider reports only tokens", () => {
    const cost = priceModelTurnUsage(model("anthropic"), {
      usage: usage(1000, 1000),
    });

    expect(cost).toBeCloseTo(0.003, 6);
  });

  it("uses the cost the provider reports when it sends one", () => {
    const cost = priceModelTurnUsage(model("openrouter"), {
      usage: usage(1000, 1000),
      rawUsage: { prompt_tokens: 1000, completion_tokens: 1000, cost: 0.5 },
    });

    expect(cost).toBeCloseTo(0.5, 6);
  });

  it("gives no cost when the model has no rates", () => {
    expect(
      priceModelTurnUsage(
        model("anthropic", { costPer1kInputTokens: undefined, costPer1kOutputTokens: undefined }),
        { usage: usage(10, 10) },
      ),
    ).toBeNull();
  });
});
