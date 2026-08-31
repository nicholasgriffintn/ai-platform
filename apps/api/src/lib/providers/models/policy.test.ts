import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
  resolveDefaultChatModel,
} from "./policy";

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "model",
    provider: "provider",
    modalities: { input: ["text"], output: ["text"] },
    contextComplexity: 3,
    reliability: 3,
    speed: 4,
    artificialAnalysis: { intelligenceIndex: 20 },
    ...overrides,
  };
}

describe("resolveDefaultChatModel", () => {
  it("selects defaults from the models executable by each account tier", () => {
    const models: ModelConfig = {
      "free-standard": model({
        matchingModel: "free-standard",
        isFree: true,
      }),
      "pro-capable": model({
        matchingModel: "pro-capable",
        contextComplexity: 5,
        reliability: 5,
        speed: 3,
        strengths: ["reasoning", "coding", "tool_use"],
        artificialAnalysis: { intelligenceIndex: 45 },
      }),
    };

    expect(resolveDefaultChatModel(models, { plan_id: "free" }).id).toBe("free-standard");
    expect(resolveDefaultChatModel(models, { plan_id: "pro" }).id).toBe("pro-capable");
  });

  it("prefers an enabled BYOK provider for a free account", () => {
    const models: ModelConfig = {
      "platform-free": model({
        matchingModel: "platform-free",
        isFree: true,
      }),
      "configured-byok": model({
        matchingModel: "configured-byok",
        isByokEnabled: true,
      }),
      "unconfigured-paid": model({
        matchingModel: "unconfigured-paid",
      }),
    };

    expect(resolveDefaultChatModel(models, { plan_id: "free" }).id).toBe("configured-byok");
  });

  it("never selects inactive, non-chat, or non-router entries", () => {
    const models: ModelConfig = {
      deprecated: model({ deprecated: true, isFree: true }),
      "status-deprecated": model({ status: "deprecated", isFree: true }),
      image: model({
        isFree: true,
        modalities: { input: ["image"], output: ["image"] },
        contextComplexity: 5,
        reliability: 5,
        speed: 5,
      }),
      "missing-router-scores": model({
        isFree: true,
        contextComplexity: undefined,
      }),
      eligible: model({
        matchingModel: "eligible",
        isFree: true,
      }),
    };

    expect(resolveDefaultChatModel(models, { plan_id: "free" }).id).toBe("eligible");
  });

  it("fails closed when no executable chat model is available", () => {
    const models: ModelConfig = {
      paid: model(),
      deprecated: model({ deprecated: true, isFree: true }),
    };

    expect(() => resolveDefaultChatModel(models, { plan_id: "free" })).toThrow(
      "No active chat model is available for this account",
    );
  });

  it("requires BYOK for Free models visible only through a configured provider", () => {
    const byokFreeModel = model({
      isFree: true,
      isByokEnabled: true,
      isPlatformEnabled: false,
    });

    expect(getModelCredentialAuthority(byokFreeModel, { plan_id: "free" })).toBe("byok");
  });

  it("requires BYOK for Pro models visible only through a configured provider", () => {
    const byokProModel = model({
      isByokEnabled: true,
      isPlatformEnabled: false,
    });

    expect(getModelCredentialAuthority(byokProModel, { plan_id: "pro" })).toBe("byok");
  });

  it("does not execute a BYOK-only provider after its key is removed", () => {
    const models = {
      paid: model({ isPlatformEnabled: false, isByokEnabled: false }),
    };

    expect(getExecutableModelsForAccount(models, { plan_id: "pro" })).toEqual({});
  });
});
