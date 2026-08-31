import { describe, expect, it } from "vitest";

import { getFeaturedModels, getModels } from ".";

describe("featured model catalogue", () => {
  it("contains only active models with descriptions", () => {
    const featuredModels = getFeaturedModels({ shouldUseCache: false });

    expect(Object.keys(featuredModels).length).toBeGreaterThan(0);

    for (const [modelId, model] of Object.entries(featuredModels)) {
      expect(model.deprecated, `${modelId} is deprecated`).not.toBe(true);
      expect(model.description?.trim(), `${modelId} is missing a description`).toBeTruthy();
    }
  });
});

describe("model tool capabilities", () => {
  it("exposes Anthropic hosted tools for Claude 5 models", () => {
    const models = getModels({ shouldUseCache: false });

    for (const modelId of ["claude-sonnet-5", "claude-opus-5"]) {
      expect(models[modelId], modelId).toMatchObject({
        provider: "anthropic",
        supportsCodeExecution: true,
        supportsSearchGrounding: true,
        supportsToolCalls: true,
        supportsWebFetch: true,
      });
    }
  });
});
