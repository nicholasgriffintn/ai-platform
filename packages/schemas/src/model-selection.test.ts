import { describe, expect, it } from "vitest";

import { createModelReferenceMap, getModelByReference } from "./model-selection.js";
import type { ModelConfig } from "./models.js";

const models: ModelConfig = {
  "kimi-k3": {
    id: "kimi-k3",
    matchingModel: "kimi-k3",
    name: "Kimi K3",
    provider: "moonshot",
  },
  "greenpt/kimi-k3": {
    id: "greenpt/kimi-k3",
    matchingModel: "kimi-k3",
    name: "Kimi K3",
    provider: "greenpt",
  },
};

describe("getModelByReference", () => {
  it("resolves a model reference shared by several providers using the provider", () => {
    const references = createModelReferenceMap(models);

    expect(getModelByReference(references, "kimi-k3")?.provider).toBe("moonshot");
    expect(getModelByReference(references, "kimi-k3", "greenpt")?.provider).toBe("greenpt");
    expect(getModelByReference(references, "kimi-k3", "moonshot")?.provider).toBe("moonshot");
  });

  it("falls back to the shared reference when the provider has no match", () => {
    const references = createModelReferenceMap(models);

    expect(getModelByReference(references, "kimi-k3", "openai")?.provider).toBe("moonshot");
    expect(getModelByReference(references, "greenpt/kimi-k3", "greenpt")?.provider).toBe("greenpt");
  });
});
