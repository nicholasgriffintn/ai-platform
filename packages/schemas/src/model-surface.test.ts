import { describe, expect, it } from "vitest";

import { getModelsByMode, isModelSelectableForAccount, runsOnDevice } from "./model-selection.js";
import type { ModelConfig } from "./models.js";

describe("device models", () => {
  it("treats a model that says nothing as running on the server", () => {
    expect(runsOnDevice({ runsOn: undefined })).toBe(false);
    expect(runsOnDevice({ runsOn: "server" })).toBe(false);
    expect(runsOnDevice({ runsOn: "device" })).toBe(true);
  });

  it("lets any account run a model on its own machine, plan or no plan", () => {
    expect(isModelSelectableForAccount({ runsOn: "device" }, false)).toBe(true);
    expect(isModelSelectableForAccount({ runsOn: "server" }, false)).toBe(false);
    expect(isModelSelectableForAccount({ runsOn: "server", isFree: true }, false)).toBe(true);
  });

  it("keeps models advertised by another machine out of the device model list", () => {
    const models: ModelConfig = {
      browser: {
        matchingModel: "browser-model",
        provider: "web-llm",
        modalities: { input: ["text"], output: ["text"] },
      },
      device: {
        matchingModel: "device-model",
        provider: "ollama",
        runsOn: "device",
        modalities: { input: ["text"], output: ["text"] },
      },
      machine: {
        matchingModel: "machine-model",
        provider: "ollama",
        runsOn: "device",
        machineId: "machine-1",
        modalities: { input: ["text"], output: ["text"] },
      },
    };

    expect(Object.keys(getModelsByMode(models, "device"))).toEqual(["device"]);
  });
});
