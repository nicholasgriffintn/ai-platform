import {
  getCatalogueModels,
  getCatalogueProviderModels,
} from "@ngriffin_uk/polychat-library-model-catalogue";
import {
  agentModelConfig,
  isLineupEligibleModel,
  type ModelConfig,
  type ModelConfigItem,
  type ModelModality,
} from "@ngriffin_uk/polychat-schemas";

import { isChatSurfaceModel } from "./chat-surface.js";
import type { availableModalities } from "./modalities.js";
import { modelSupportsModality } from "./modalities.js";

export interface ModelQueryOptions {
  excludeModalities?: ModelModality[];
  chatSurfaceOnly?: boolean;
}

export const modelConfig: ModelConfig = {
  ...getCatalogueModels(),
  ...agentModelConfig,
};

export const getProviderModels = getCatalogueProviderModels;

const cachedModelsByOptions = new Map<string, ModelConfig>();
let cachedFreeModels: ModelConfig | null = null;
let cachedFeaturedModels: ModelConfig | null = null;
let cachedLineupModels: ModelConfig | null = null;
let cachedStrengths: string[] | null = null;

function filterModels(predicate: (model: ModelConfigItem) => boolean): ModelConfig {
  return Object.fromEntries(Object.entries(modelConfig).filter(([, model]) => predicate(model)));
}

export function getModelConfigById(modelId: string): ModelConfigItem | undefined {
  return modelConfig[modelId];
}

export function findModelConfigByMatchingModel(
  matchingModel: string,
  provider?: string,
): ModelConfigItem | null {
  let fallbackMatch: ModelConfigItem | null = null;

  for (const model of Object.values(modelConfig)) {
    if (model.matchingModel !== matchingModel) {
      continue;
    }

    if (!fallbackMatch) {
      fallbackMatch = model;
    }

    if (!provider || model.provider === provider) {
      return model;
    }
  }

  return provider ? null : fallbackMatch;
}

export function getModels(options: ModelQueryOptions = {}): ModelConfig {
  const cacheKey = JSON.stringify([
    [...(options.excludeModalities ?? [])].sort((left, right) => left.localeCompare(right)),
    options.chatSurfaceOnly ?? false,
  ]);
  const cached = cachedModelsByOptions.get(cacheKey);

  if (cached) {
    return cached;
  }

  const models = filterModels(
    (model) =>
      !model.beta &&
      !options.excludeModalities?.some((excluded) => modelSupportsModality(model, excluded)) &&
      (!options.chatSurfaceOnly || isChatSurfaceModel(model)),
  );

  cachedModelsByOptions.set(cacheKey, models);

  return models;
}

export function getAvailableStrengths(): string[] {
  if (cachedStrengths) {
    return cachedStrengths;
  }

  const strengths = new Set<string>();

  for (const model of Object.values(modelConfig)) {
    for (const strength of model.strengths ?? []) {
      strengths.add(strength);
    }
  }

  cachedStrengths = Array.from(strengths);

  return cachedStrengths;
}

export function getFreeModels(): ModelConfig {
  cachedFreeModels ??= filterModels((model) => Boolean(model.isFree));

  return cachedFreeModels;
}

export function getFeaturedModels(): ModelConfig {
  cachedFeaturedModels ??= filterModels(
    (model) => Boolean(model.isFeatured) && !model.deprecated && model.status !== "deprecated",
  );

  return cachedFeaturedModels;
}

export function getLineupModels(): ModelConfig {
  cachedLineupModels ??= filterModels(isLineupEligibleModel);

  return cachedLineupModels;
}

export function getLineupFreeModels(): ModelConfig {
  return Object.fromEntries(Object.entries(getLineupModels()).filter(([, model]) => model.isFree));
}

export function getModelsByCapability(capability: string): ModelConfig {
  return filterModels((model) =>
    Boolean(model.strengths?.includes(capability as (typeof availableModalities)[number])),
  );
}

export function getModelsByModality(modality: ModelModality): ModelConfig {
  return filterModels((model) => modelSupportsModality(model, modality));
}

export function getModelsByOutputModality(modality: ModelModality): ModelConfig {
  return filterModels((model) => (model.modalities?.output ?? []).includes(modality));
}

export function getModelIdsByOutput(
  config: ModelConfig,
  provider: string,
  modality: ModelModality,
): string[] {
  return Object.entries(config)
    .filter(
      ([, model]) =>
        model.provider === provider && (model.modalities?.output ?? []).includes(modality),
    )
    .map(([id]) => id);
}

export function normaliseModelIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
