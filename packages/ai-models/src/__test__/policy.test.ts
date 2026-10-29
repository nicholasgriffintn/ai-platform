import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
  rankPolicyModelsByMediaScore,
  resolveHostedAgentModel,
  resolveTierModel,
} from "../policy.js";

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "model",
    provider: "provider",
    modalities: { input: ["text"], output: ["text"] },
    ...overrides,
  };
}

describe("resolveTierModel", () => {
  it("resolves the coding role separately from the agent role", () => {
    const models: ModelConfig = {
      "google-ai-studio/gemini-3.8-flash": model({
        matchingModel: "gemini-3.8-flash",
        provider: "google-ai-studio",
      }),
      "@cf/moonshotai/kimi-k2.7-code": model({
        matchingModel: "@cf/moonshotai/kimi-k2.7-code",
        provider: "workers-ai",
      }),
    };

    expect(resolveTierModel(models, { plan_id: "pro" }, "medium", "agent")?.id).toBe(
      "google-ai-studio/gemini-3.8-flash",
    );
    expect(resolveTierModel(models, { plan_id: "pro" }, "medium", "coding")?.id).toBe(
      "@cf/moonshotai/kimi-k2.7-code",
    );
    expect(resolveTierModel(models, { plan_id: "free" }, "medium", "coding")).toBeNull();
  });
});

describe("resolveHostedAgentModel", () => {
  const models: ModelConfig = {
    "google-ai-studio/gemini-3.8-flash": model({
      matchingModel: "gemini-3.8-flash",
      provider: "google-ai-studio",
    }),
    "@cf/moonshotai/kimi-k2.7-code": model({
      matchingModel: "kimi-k2.7-code",
      provider: "workers-ai",
    }),
  };

  it("prefers an explicit executable model by id or matching model", () => {
    expect(
      resolveHostedAgentModel(
        models,
        { plan_id: "pro" },
        "medium",
        "agent",
        "@cf/moonshotai/kimi-k2.7-code",
      )?.id,
    ).toBe("@cf/moonshotai/kimi-k2.7-code");
    expect(
      resolveHostedAgentModel(models, { plan_id: "pro" }, "medium", "agent", "gemini-3.8-flash")
        ?.id,
    ).toBe("google-ai-studio/gemini-3.8-flash");
  });

  it("returns null for an explicit model the account cannot execute", () => {
    expect(
      resolveHostedAgentModel(models, { plan_id: "pro" }, "medium", "agent", "no-such-model"),
    ).toBeNull();
    expect(
      resolveHostedAgentModel(
        models,
        { plan_id: "free" },
        "medium",
        "agent",
        "@cf/moonshotai/kimi-k2.7-code",
      ),
    ).toBeNull();
  });

  it("falls back to the tier lineup for the requested role", () => {
    expect(resolveHostedAgentModel(models, { plan_id: "pro" }, "medium", "agent")?.id).toBe(
      "google-ai-studio/gemini-3.8-flash",
    );
    expect(resolveHostedAgentModel(models, { plan_id: "pro" }, "medium", "coding")?.id).toBe(
      "@cf/moonshotai/kimi-k2.7-code",
    );
  });
});

describe("rankPolicyModelsByMediaScore", () => {
  const arena = (value: number) => ({
    mediaScores: [{ key: "text_to_speechElo", label: "Text-to-speech arena", value }],
  });

  it("ranks scored voices by arena score, then unscored ones by lineup order", () => {
    const models: ModelConfig = {
      melotts: model({ matchingModel: "melotts", provider: "workers-ai", isFree: true }),
      "aura-1": model({ matchingModel: "aura-1", provider: "workers-ai", isFree: true }),
      polly: model({ provider: "polly", isByokEnabled: true, artificialAnalysis: arena(1067) }),
      eleven: model({
        provider: "elevenlabs",
        isByokEnabled: true,
        artificialAnalysis: arena(1332),
      }),
      sonic: model({
        provider: "cartesia",
        isPlatformEnabled: false,
        artificialAnalysis: arena(1292),
      }),
    };

    const ranked = rankPolicyModelsByMediaScore(
      models,
      "text_to_speechElo",
      [
        { model: "aura-1", provider: "workers-ai" },
        { model: "melotts", provider: "workers-ai" },
      ],
      { plan_id: "free" },
    );

    expect(ranked.map((entry) => entry.id)).toEqual(["eleven", "polly", "aura-1", "melotts"]);
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
