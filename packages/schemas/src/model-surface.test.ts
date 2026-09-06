import { describe, expect, it } from "vitest";

import {
  isModelSelectableForAccount,
  runsOnDevice,
  selectModelsForSurface,
} from "./model-selection";
import type { ModelConfig } from "./models";

const models = {
  "gpt-5": { name: "GPT-5", provider: "openai" },
  "ollama-gemma3-4b": { name: "Gemma 3 4B", provider: "ollama", runsOn: "device" },
  "lmstudio-qwen3": { name: "Qwen3", provider: "lmstudio", runsOn: "device" },
} as unknown as ModelConfig;

describe("selectModelsForSurface", () => {
  it("keeps device models away from the web, which cannot reach a runtime", () => {
    const web = selectModelsForSurface(models, "web");

    expect(Object.keys(web)).toEqual(["gpt-5"]);
  });

  it("offers both server and device models on the desktop", () => {
    const desktop = selectModelsForSurface(models, "desktop");

    expect(Object.keys(desktop)).toEqual(["gpt-5", "ollama-gemma3-4b", "lmstudio-qwen3"]);
  });

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
});
