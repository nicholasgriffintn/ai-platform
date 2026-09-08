import type { LastModelSelection, ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getLastUsedPickerModel, getPickerScopeModels } from "./model-picker.js";

const models: ModelConfig = {
  cloud: {
    matchingModel: "shared",
    provider: "openai",
    modalities: { input: ["text"], output: ["text"] },
  },
  browser: {
    matchingModel: "shared",
    provider: "web-llm",
    modalities: { input: ["text"], output: ["text"] },
  },
  local: {
    matchingModel: "shared",
    provider: "ollama",
    runsOn: "device",
    modalities: { input: ["text"], output: ["text"] },
  },
  remote: {
    matchingModel: "shared",
    provider: "ollama",
    runsOn: "device",
    machineId: "office",
    modalities: { input: ["text"], output: ["text"] },
  },
  hidden: { matchingModel: "hidden", provider: "openai", hiddenFromDefaultList: true },
  embedding: {
    matchingModel: "embedding",
    provider: "openai",
    modalities: { input: ["text"], output: ["embedding"] },
  },
};
const saved: LastModelSelection = {
  modelId: "remote",
  name: "Shared",
  provider: "ollama",
  computeSite: "machine",
  machineId: "office",
  locationLabel: "Office PC",
};

describe("model picker catalogue", () => {
  it("includes each execution location without admitting hidden or embedding-only models", () => {
    expect(Object.keys(getPickerScopeModels(models, "default", false)).sort()).toEqual([
      "browser",
      "cloud",
      "local",
      "remote",
    ]);
  });
  it("does not mistake another installation's local runtime for the saved device", () => {
    const localChoice: LastModelSelection = {
      ...saved,
      modelId: "local",
      computeSite: "device",
      machineId: undefined,
      originInstallationId: "first",
    };

    expect(getLastUsedPickerModel(localChoice, models, "second")[0].isExecutable).toBe(false);
    expect(getLastUsedPickerModel(localChoice, models, "first")[0].id).toBe("local");
    expect(getLastUsedPickerModel(localChoice, models, "first")[0].isExecutable).not.toBe(false);
  });
  it("keeps live provider restrictions and agent tool requirements", () => {
    expect(getPickerScopeModels(models, "live", false, "openai")).toEqual({});
    expect(getPickerScopeModels(models, "default", true)).toEqual({});
  });
  it("keeps an unavailable saved device visible without making it executable, then resolves its return", () => {
    const missing = getLastUsedPickerModel(saved, {});

    expect(missing[0]).toMatchObject({
      id: "remote",
      name: "Shared",
      isExecutable: false,
      machineId: "office",
    });
    expect(getLastUsedPickerModel(saved, models)[0]).toMatchObject({
      id: "remote",
      machineId: "office",
    });
    expect(
      getLastUsedPickerModel(saved, { remote: { ...models.remote, machineId: "another" } })[0]
        .isExecutable,
    ).toBe(false);
  });
});
