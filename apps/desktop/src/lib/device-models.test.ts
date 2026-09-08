import { describe, expect, it, vi } from "vitest";

vi.mock("./desktop-backend", () => ({
  tauriDesktopBackend: {
    listEndpoints: async () => [{ id: "ollama-local", kind: "model", vendor: "ollama" }],
    discoverModels: async () => [
      {
        endpointId: "ollama-local",
        nativeId: "gemma3:1b",
        displayName: "gemma3:1b",
        contextTokens: null,
        parameterSizeBytes: null,
        capabilities: { tools: false, vision: false, thinking: false },
        loaded: true,
        discoveredAt: "2026-09-08T10:00:00Z",
      },
    ],
    probeAgentTool: async () => {
      throw new Error("Invalid native probe response");
    },
  },
}));

import { discoverDeviceModels } from "./device-models";

describe("desktop model discovery", () => {
  it("keeps connected Ollama models when native agent probes fail", async () => {
    const models = await discoverDeviceModels();

    expect(models["ollama/gemma3:1b"]).toMatchObject({
      matchingModel: "gemma3:1b",
      runtimeEndpointId: "ollama-local",
      isExecutable: true,
    });
  });
});
