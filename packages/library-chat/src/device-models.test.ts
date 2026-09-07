import type { DiscoveredModel } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildDeviceModels } from "./device-models.js";

function discovered(overrides: Partial<DiscoveredModel>): DiscoveredModel {
  return {
    endpointId: "ollama-loopback",
    nativeId: "gemma3:4b",
    displayName: "Gemma 3 4B",
    contextTokens: 8192,
    parameterSizeBytes: null,
    capabilities: { tools: true, vision: false, thinking: false },
    loaded: false,
    discoveredAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildDeviceModels", () => {
  it("offers only what the runtime reported as installed", () => {
    const models = buildDeviceModels([
      { vendor: "ollama", models: [discovered({}), discovered({ nativeId: "qwen3:8b" })] },
      { vendor: "lmstudio", models: [] },
    ]);

    expect(Object.keys(models)).toEqual(["ollama/gemma3:4b", "ollama/qwen3:8b"]);
  });

  it("keeps the native id the runtime answers to, and marks the model as device-run", () => {
    const models = buildDeviceModels([{ vendor: "ollama", models: [discovered({})] }]);
    const model = models["ollama/gemma3:4b"];

    expect(model.matchingModel).toBe("gemma3:4b");
    expect(model.provider).toBe("ollama");
    expect(model.runsOn).toBe("device");
    expect(model.isExecutable).toBe(true);
  });

  it("carries the capabilities the runtime reported rather than assuming them", () => {
    const models = buildDeviceModels([
      {
        vendor: "lmstudio",
        models: [
          discovered({
            nativeId: "qwen3-vl",
            capabilities: { tools: false, vision: true, thinking: false },
          }),
        ],
      },
    ]);
    const model = models["lmstudio/qwen3-vl"];

    expect(model.supportsToolCalls).toBe(false);
    expect(model.multimodal).toBe(true);
    expect(model.modalities?.input).toContain("image");
  });
});
