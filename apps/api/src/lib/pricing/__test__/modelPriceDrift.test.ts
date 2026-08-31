import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { ArtificialAnalysisModelRecord } from "~/lib/artificial-analysis/types";

import { detectModelPriceDrift } from "../modelPriceDrift";

function makeReference(
  overrides: Partial<ArtificialAnalysisModelRecord> = {},
): ArtificialAnalysisModelRecord {
  return {
    id: "aa-1",
    name: "Claude Sonnet 5",
    slug: "claude-sonnet-5",
    evaluations: {},
    pricing: {},
    price_1m_input_tokens: 2,
    price_1m_output_tokens: 10,
    source: "artificial_analysis",
    source_url: "https://artificialanalysis.ai/",
    ingested_at: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

function makeCatalogue(entries: Record<string, unknown>): ModelConfig {
  return entries as ModelConfig;
}

describe("detectModelPriceDrift", () => {
  it("reports nothing when catalogue prices agree with the reference", () => {
    const report = detectModelPriceDrift(
      makeCatalogue({
        "claude-sonnet-5": {
          matchingModel: "claude-sonnet-5",
          provider: "anthropic",
          costPer1kInputTokens: 0.002,
          costPer1kOutputTokens: 0.01,
        },
      }),
      [makeReference()],
    );

    expect(report).toMatchObject({ compared: 1, matched: 1, drifted: [] });
  });

  it("reports the divergence when a catalogue price is stale", () => {
    const report = detectModelPriceDrift(
      makeCatalogue({
        "claude-sonnet-5": {
          matchingModel: "claude-sonnet-5",
          provider: "anthropic",
          costPer1kInputTokens: 0.003,
          costPer1kOutputTokens: 0.01,
        },
      }),
      [makeReference()],
    );

    expect(report.drifted).toHaveLength(1);
    expect(report.drifted[0]).toMatchObject({
      modelId: "claude-sonnet-5",
      provider: "anthropic",
      referenceId: "aa-1",
      catalogueCostPer1kInputTokens: 0.003,
      referenceCostPer1kInputTokens: 0.002,
    });
    expect(report.drifted[0]?.inputDrift).toBeCloseTo(0.5);
  });

  it("stays quiet inside the tolerance band", () => {
    const report = detectModelPriceDrift(
      makeCatalogue({
        "claude-sonnet-5": {
          matchingModel: "claude-sonnet-5",
          costPer1kInputTokens: 0.0022,
          costPer1kOutputTokens: 0.01,
        },
      }),
      [makeReference()],
    );

    expect(report.drifted).toEqual([]);
  });

  it("matches on normalised identifiers and skips models with no reference", () => {
    const report = detectModelPriceDrift(
      makeCatalogue({
        "claude-sonnet-5": {
          matchingModel: "Claude_Sonnet-5",
          costPer1kInputTokens: 0.002,
          costPer1kOutputTokens: 0.01,
        },
        "house-model": {
          matchingModel: "house-model",
          costPer1kInputTokens: 0.5,
        },
        "free-model": {
          matchingModel: "free-model",
        },
      }),
      [makeReference()],
    );

    expect(report).toMatchObject({ compared: 2, matched: 1, drifted: [] });
  });

  it("ignores a reference price of zero rather than reporting infinite drift", () => {
    const report = detectModelPriceDrift(
      makeCatalogue({
        "claude-sonnet-5": {
          matchingModel: "claude-sonnet-5",
          costPer1kInputTokens: 0.002,
          costPer1kOutputTokens: 0.01,
        },
      }),
      [makeReference({ price_1m_input_tokens: 0, price_1m_output_tokens: 0 })],
    );

    expect(report).toMatchObject({ matched: 1, drifted: [] });
  });
});
