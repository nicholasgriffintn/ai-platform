import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { rankSystemRoleModels } from "../system-model-ranking.js";

function chat(
  intelligenceIndex: number | undefined,
  cost: number,
  overrides: Partial<ModelConfigItem> = {},
): ModelConfigItem {
  return {
    matchingModel: "model",
    provider: "provider",
    modalities: { input: ["text"], output: ["text"] },
    contextWindow: 1_000_000,
    costPer1kInputTokens: cost,
    costPer1kOutputTokens: cost,
    ...(intelligenceIndex === undefined ? {} : { artificialAnalysis: { intelligenceIndex } }),
    ...overrides,
  };
}

const models: ModelConfig = {
  frontier: chat(70, 0.01),
  close: chat(76, 0.001),
  middling: chat(40, 0.0001),
  unscored: chat(undefined, 0.00001),
  short: chat(80, 0.005, { contextWindow: 32_000 }),
};

const ids = (ranked: { id: string }[]) => ranked.map(({ id }) => id);

describe("rankSystemRoleModels", () => {
  it("ranks writing by benchmark for quality and takes the cheapest near-best model for value", () => {
    expect(ids(rankSystemRoleModels(models, "writing", "quality"))).toEqual([
      "short",
      "close",
      "frontier",
      "middling",
      "unscored",
    ]);
    expect(ids(rankSystemRoleModels(models, "writing", "value")).slice(0, 3)).toEqual([
      "close",
      "short",
      "frontier",
    ]);
  });

  it("drops models whose context window is too small for summaries", () => {
    expect(ids(rankSystemRoleModels(models, "compaction", "quality"))).not.toContain("short");
  });

  it("orders small jobs by cost regardless of benchmarks", () => {
    expect(ids(rankSystemRoleModels(models, "titling", "quality"))[0]).toBe("unscored");
  });
});

describe("code completion models", () => {
  const coding = (cost: number, overrides: Partial<ModelConfigItem> = {}) =>
    chat(undefined, cost, { strengths: ["coding"], ...overrides });

  it("offers coding models and keeps native FIM models ahead of cheaper prompted ones", () => {
    const ranked = rankSystemRoleModels(
      {
        prompted: coding(0.0001),
        native: chat(undefined, 0.01, { supportsFim: true }),
        general: chat(undefined, 0.00001, { strengths: ["chat"] }),
        pricier: coding(0.001),
      },
      "fim",
      "value",
    );

    expect(ids(ranked)).toEqual(["native", "prompted", "pricier"]);
  });

  it("leaves next edit to models with the native capability", () => {
    expect(rankSystemRoleModels({ prompted: coding(0.0001) }, "nextEdit", "value")).toEqual([]);
  });
});
