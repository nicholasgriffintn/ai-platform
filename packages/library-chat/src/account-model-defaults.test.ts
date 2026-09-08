import { describe, expect, it } from "vitest";

import { resolveAccountModelSelection } from "./account-model-defaults.js";

describe("resolveAccountModelSelection", () => {
  it("prefers the account model over its tier and retains compute site", () => {
    expect(
      resolveAccountModelSelection({
        default_model_id: "model-1",
        default_model_tier: "ultra",
        default_compute_site: "device",
      }),
    ).toEqual({ model: "model-1", modelTier: null, computeSite: "device" });
  });

  it("uses the account tier when no model is selected", () => {
    expect(resolveAccountModelSelection({ default_model_tier: "high" })).toEqual({
      model: null,
      modelTier: "high",
      computeSite: "hosted",
    });
  });
});
