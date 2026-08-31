import {
  isActiveModel,
  MODEL_POLICY_REFERENCES,
  REALTIME_LIVE_PROVIDER_MANIFEST,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getFeaturedModels, getModels } from ".";
import { getExecutableModelsForAccount } from "./policy";

describe("featured model catalogue", () => {
  it("contains only active models with descriptions", () => {
    const featuredModels = getFeaturedModels({ shouldUseCache: false });

    expect(Object.keys(featuredModels).length).toBeGreaterThan(0);

    for (const [modelId, model] of Object.entries(featuredModels)) {
      expect(model.deprecated, `${modelId} is deprecated`).not.toBe(true);
      expect(model.description?.trim(), `${modelId} is missing a description`).toBeTruthy();
    }
  });
});

describe("model tool capabilities", () => {
  it("exposes Anthropic hosted tools for Claude 5 models", () => {
    const models = getModels({ shouldUseCache: false });

    for (const modelId of ["claude-sonnet-5", "claude-opus-5"]) {
      expect(models[modelId], modelId).toMatchObject({
        provider: "anthropic",
        supportsCodeExecution: true,
        supportsSearchGrounding: true,
        supportsToolCalls: true,
        supportsWebFetch: true,
      });
    }
  });
});

describe("central model policy catalogue", () => {
  it("resolves every policy reference to an active model from the expected provider", () => {
    const models = getModels({ shouldUseCache: false });
    const references = MODEL_POLICY_REFERENCES;

    expect(references.length).toBeGreaterThan(0);

    for (const reference of references) {
      const entry = models[reference.model];

      if (!entry) {
        throw new Error(`${reference.provider}:${reference.model} is absent from the catalogue`);
      }

      expect(entry.provider, reference.model).toBe(reference.provider);
      expect(isActiveModel(entry), `${reference.model} is inactive`).toBe(true);
    }
  });

  it("resolves every realtime default to an active model from the expected provider", () => {
    const models = getModels({ shouldUseCache: false });

    for (const reference of REALTIME_LIVE_PROVIDER_MANIFEST) {
      const entry = models[reference.defaultModelId];

      if (!entry) {
        throw new Error(`${reference.id}:${reference.defaultModelId} is absent from the catalogue`);
      }

      expect(entry.provider, reference.defaultModelId).toBe(reference.id);
      expect(isActiveModel(entry), `${reference.defaultModelId} is inactive`).toBe(true);
    }
  });

  it.each([
    ["groq/compound", "groq-openai-gpt-oss-120b", "groq"],
    ["groq/compound-mini", "groq-openai-gpt-oss-20b", "groq"],
    ["gpt-realtime-mini", "gpt-realtime-2.1-mini", "openai"],
  ])("deprecates %s with an active replacement", (modelId, replacementId, provider) => {
    const models = getModels({ shouldUseCache: false });
    const retiredModel = models[modelId];
    const replacement = models[replacementId];

    expect(retiredModel).toMatchObject({
      deprecated: true,
      provider,
      replacementModel: replacementId,
    });

    if (!replacement) {
      throw new Error(`${replacementId} is absent from the catalogue`);
    }

    expect(replacement.provider).toBe(provider);
    expect(isActiveModel(replacement)).toBe(true);
  });

  it("keeps the current OpenAI realtime family active", () => {
    const models = getModels({ shouldUseCache: false });
    const executableModels = getExecutableModelsForAccount(models, { plan_id: "pro" });

    for (const modelId of ["gpt-realtime-2", "gpt-realtime-2.1", "gpt-realtime-2.1-mini"]) {
      expect(models[modelId]?.provider, modelId).toBe("openai");
      expect(isActiveModel(models[modelId]), `${modelId} is inactive`).toBe(true);
      expect(executableModels[modelId], `${modelId} is not executable`).toBeDefined();
    }
  });
});
