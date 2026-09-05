import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
  resolveDefaultChatModel,
  resolveTierModel,
} from "./policy";

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "model",
    provider: "provider",
    modalities: { input: ["text"], output: ["text"] },
    ...overrides,
  };
}

describe("resolveDefaultChatModel", () => {
  it("selects the Medium tier model each account can execute", () => {
    const models: ModelConfig = {
      "google-ai-studio/gemini-3.5-flash": model({
        matchingModel: "gemini-3.5-flash",
        provider: "google-ai-studio",
        isFree: true,
      }),
      "gpt-5.6-sol": model({
        matchingModel: "gpt-5.6-sol",
        provider: "openai",
      }),
    };

    expect(resolveDefaultChatModel(models, { plan_id: "free" }).id).toBe(
      "google-ai-studio/gemini-3.5-flash",
    );
    expect(resolveDefaultChatModel(models, { plan_id: "pro" }).id).toBe("gpt-5.6-sol");
  });

  it("falls back to an enabled BYOK provider when nothing in the lineup is executable", () => {
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

  it("never selects inactive or non-chat entries", () => {
    const models: ModelConfig = {
      deprecated: model({ deprecated: true, isFree: true }),
      "status-deprecated": model({ status: "deprecated", isFree: true }),
      image: model({
        isFree: true,
        modalities: { input: ["image"], output: ["image"] },
      }),
      realtime: model({ isFree: true, supportsRealtimeSession: true }),
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
});

describe("resolveTierModel", () => {
  it("resolves the coding role separately from the agent role", () => {
    const models: ModelConfig = {
      "claude-sonnet-5": model({ matchingModel: "claude-sonnet-5", provider: "anthropic" }),
      "gpt-5.6-sol": model({ matchingModel: "gpt-5.6-sol", provider: "openai" }),
    };

    expect(resolveTierModel(models, { plan_id: "pro" }, "medium", "agent")?.id).toBe("gpt-5.6-sol");
    expect(resolveTierModel(models, { plan_id: "pro" }, "medium", "coding")?.id).toBe(
      "claude-sonnet-5",
    );
    expect(resolveTierModel(models, { plan_id: "free" }, "medium", "coding")).toBeNull();
  });
});

describe("credential authority", () => {
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
