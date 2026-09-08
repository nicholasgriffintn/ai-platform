import type { DiscoveredModel, MachineRecord } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildDeviceModels, buildMachineModels } from "./device-models.js";

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

  it("offers only the input and tools the desktop execution path supports", () => {
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
    expect(model.multimodal).toBe(false);
    expect(model.supportsAttachments).toBe(false);
    expect(model.modalities?.input).toEqual(["text"]);
  });
});

describe("buildMachineModels", () => {
  it("only merges online ready machine runtimes and keeps machine ids unique", () => {
    const machine: MachineRecord = {
      machineId: "office-desktop",
      label: "Office desktop",
      platform: "macos",
      appVersion: "0.1.0",
      lastSeenAt: "2026-09-07T09:00:00.000Z",
      online: true,
      capabilities: ["model-run"],
      runtimes: [
        {
          kind: "model",
          vendor: "ollama",
          readiness: {
            status: "ready",
            checkedAt: "2026-09-07T09:00:00.000Z",
            version: "0.12.0",
          },
          models: [
            {
              nativeId: "gemma3:4b",
              displayName: "Gemma 3 4B",
              contextTokens: 8192,
              capabilities: { tools: true, vision: false, thinking: false },
              loaded: false,
            },
          ],
        },
        {
          kind: "model",
          vendor: "lmstudio",
          readiness: {
            status: "unreachable",
            checkedAt: "2026-09-07T09:00:00.000Z",
            detail: null,
          },
          models: [
            {
              nativeId: "hidden",
              displayName: "Hidden",
              contextTokens: 8192,
              capabilities: { tools: false, vision: false, thinking: false },
              loaded: false,
            },
          ],
        },
      ],
    };

    const models = buildMachineModels([machine]);
    const model = models["machine/office-desktop/ollama/gemma3:4b"];

    expect(Object.keys(models)).toEqual(["machine/office-desktop/ollama/gemma3:4b"]);
    expect(model.machineId).toBe("office-desktop");
    expect(model.isExecutable).toBe(false);
    expect(model.description).toContain("Office desktop");
  });
});
