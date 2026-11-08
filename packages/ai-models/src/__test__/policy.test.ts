import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getExecutableModelsForAccount, getModelCredentialAuthority } from "../policy.js";

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "model",
    provider: "provider",
    modalities: { input: ["text"], output: ["text"] },
    ...overrides,
  };
}

describe("credential authority", () => {
  it("requires BYOK for Free models visible only through a configured provider", () => {
    const byokFreeModel = model({
      isFree: true,
      isByokEnabled: true,
      isPlatformEnabled: false,
    });

    expect(getModelCredentialAuthority(byokFreeModel, { plan_id: "free" })).toBe("byok");
  });

  it("does not execute a BYOK-only provider after its key is removed", () => {
    const models = {
      paid: model({ isPlatformEnabled: false, isByokEnabled: false }),
    };

    expect(getExecutableModelsForAccount(models, { plan_id: "pro" })).toEqual({});
  });
});
