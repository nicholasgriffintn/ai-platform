import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createToolCostEstimator } from "../tool-cost";

const imageModel = {
  matchingModel: "image-model",
  provider: "replicate",
  costPerImage: 0.05,
} as ModelConfigItem;

function estimator(modelConfig?: ModelConfigItem) {
  return createToolCostEstimator({
    resolveModelConfig: vi.fn(async () => modelConfig),
    sandboxTimeoutSeconds: 600,
  });
}

describe("createToolCostEstimator", () => {
  it("prices a sandbox from its timeout, the longest it could bill", async () => {
    const estimate = estimator();
    const short = await estimate({ name: "run_sandbox_task", arguments: { timeoutSeconds: 60 } });
    const configured = await estimate({ name: "run_sandbox_task", arguments: {} });

    expect(short).toBeGreaterThan(0);
    expect(configured).toBeGreaterThan(short ?? 0);
  });

  it("prices a media tool from the chosen model's rate", async () => {
    expect(
      await estimator(imageModel)({ name: "create_image", arguments: { model: "image-model" } }),
    ).toBeGreaterThan(0);
  });

  it("calls a cost unknown when the model has no rate or no model is named", async () => {
    const unpriced = { ...imageModel, costPerImage: undefined };

    expect(
      await estimator(unpriced)({ name: "create_image", arguments: { model: "image-model" } }),
    ).toBeNull();
    expect(await estimator(imageModel)({ name: "create_image", arguments: {} })).toBeNull();
  });

  it("calls every other tool unknown", async () => {
    expect(await estimator()({ name: "web_search", arguments: {} })).toBeNull();
  });
});
