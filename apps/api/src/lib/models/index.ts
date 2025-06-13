import type { IUser, ModelConfig } from "~/types";
import {
  type availableCapabilities,
  type availableModelTypes,
  defaultModel,
} from "./constants";

import { anthropicModelConfig } from "./anthropic";
import { bedrockModelConfig } from "./bedrock";
import { deepseekModelConfig } from "./deepseek";
import { fireworksModelConfig } from "./fireworks";
import { githubModelsConfig } from "./githubmodels";
import { googleAiStudioModelConfig } from "./google-ai-studio";
import { grokModelConfig } from "./grok";
import { groqModelConfig } from "./groq";
import { huggingfaceModelConfig } from "./huggingface";
import { hyperbolicModelConfig } from "./hyperbolic";
import { mistralModelConfig } from "./mistral";
import { ollamaModelConfig } from "./ollama";
import { openaiModelConfig } from "./openai";
import { openrouterModelConfig } from "./openrouter";
import { perplexityModelConfig } from "./perplexity";
import { togetherAiModelConfig } from "./together-ai";
import { v0ModelConfig } from "./v0";
import { workersAiModelConfig } from "./workersai";

import { Database } from "~/lib/database";
import type { IEnv, ModelConfigItem } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "MODELS" });

export {
  availableCapabilities,
  availableModelTypes,
  defaultModel,
  defaultProvider,
} from "./constants";

const modelConfig: ModelConfig = {
  ...openaiModelConfig,
  ...anthropicModelConfig,
  ...mistralModelConfig,
  ...ollamaModelConfig,
  ...bedrockModelConfig,
  ...deepseekModelConfig,
  ...githubModelsConfig,
  ...grokModelConfig,
  ...groqModelConfig,
  ...huggingfaceModelConfig,
  ...openrouterModelConfig,
  ...perplexityModelConfig,
  ...workersAiModelConfig,
  ...togetherAiModelConfig,
  ...googleAiStudioModelConfig,
  ...fireworksModelConfig,
  ...hyperbolicModelConfig,
  ...v0ModelConfig,
};

const modelConfigCache = new Map<string, any>();
const userModelCache = new Map<string, Record<string, ModelConfigItem>>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 500;
const cacheTimestamps = new Map<string, number>();

function isCacheValid(key: string): boolean {
  const timestamp = cacheTimestamps.get(key);
  return timestamp ? (Date.now() - timestamp) < CACHE_TTL : false;
}

function setCacheEntry(key: string, value: any): void {
  if (modelConfigCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cacheTimestamps.keys().next().value;
    modelConfigCache.delete(oldestKey);
    cacheTimestamps.delete(oldestKey);
  }
  
  modelConfigCache.set(key, value);
  cacheTimestamps.set(key, Date.now());
}

export function getModelConfig(model?: string) {
  const key = model || defaultModel;
  
  if (modelConfigCache.has(key) && isCacheValid(key)) {
    return modelConfigCache.get(key);
  }
  
  const config = (model && modelConfig[model]) || modelConfig[defaultModel];
  setCacheEntry(key, config);
  
  return config;
}

export function getModelConfigByModel(model: string) {
  const cacheKey = `by-model-${model}`;
  
  if (modelConfigCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return modelConfigCache.get(cacheKey);
  }
  
  const config = model && modelConfig[model as keyof typeof modelConfig];
  setCacheEntry(cacheKey, config);
  
  return config;
}

export function getMatchingModel(model: string = defaultModel) {
  const cacheKey = `matching-${model}`;
  
  if (modelConfigCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return modelConfigCache.get(cacheKey);
  }
  
  const matchingModel = model && getModelConfig(model).matchingModel;
  setCacheEntry(cacheKey, matchingModel);
  
  return matchingModel;
}

export function getModelConfigByMatchingModel(matchingModel: string) {
  const cacheKey = `by-matching-${matchingModel}`;
  
  if (modelConfigCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return modelConfigCache.get(cacheKey);
  }
  
  let result = null;
  for (const model in modelConfig) {
    if (
      modelConfig[model as keyof typeof modelConfig].matchingModel ===
      matchingModel
    ) {
      result = modelConfig[model as keyof typeof modelConfig];
      break;
    }
  }
  
  setCacheEntry(cacheKey, result);
  return result;
}

let cachedModels: typeof modelConfig | null = null;
let cachedFreeModels: typeof modelConfig | null = null;
let cachedFeaturedModels: typeof modelConfig | null = null;
let cachedRouterModels: typeof modelConfig | null = null;

export function getModels() {
  if (cachedModels) return cachedModels;
  
  cachedModels = Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (!model.beta) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
  
  return cachedModels;
}

export function getFreeModels() {
  if (cachedFreeModels) return cachedFreeModels;
  
  cachedFreeModels = Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.isFree) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
  
  return cachedFreeModels;
}

export function getFeaturedModels() {
  if (cachedFeaturedModels) return cachedFeaturedModels;
  
  cachedFeaturedModels = Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.isFeatured) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
  
  return cachedFeaturedModels;
}

export function getIncludedInRouterModels() {
  if (cachedRouterModels) return cachedRouterModels;
  
  cachedRouterModels = Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.includedInRouter) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
  
  return cachedRouterModels;
}

export function getModelsByCapability(capability: string) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (
        model.strengths?.includes(
          capability as (typeof availableCapabilities)[number],
        )
      ) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getModelsByType(type: string) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.type?.includes(type as (typeof availableModelTypes)[number])) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export async function filterModelsForUserAccess(
  allModels: Record<string, ModelConfigItem>,
  env: IEnv,
  userId?: number,
): Promise<Record<string, ModelConfigItem>> {
  const cacheKey = `user-models-${userId || 'anonymous'}`;
  
  if (userModelCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return userModelCache.get(cacheKey)!;
  }

  const allFreeModels = getFreeModels();
  const alwaysEnabledProvidersEnvVar = env.ALWAYS_ENABLED_PROVIDERS;
  const alwaysEnabledProviders = new Set(
    alwaysEnabledProvidersEnvVar?.split(",") || [],
  );

  const freeModels: Record<string, ModelConfigItem> = {};
  for (const modelId in allFreeModels) {
    const model = allFreeModels[modelId];
    if (alwaysEnabledProviders.has(model.provider)) {
      freeModels[modelId] = model;
    }
  }
  const freeModelIds = new Set(Object.keys(freeModels));

  const filteredModels: Record<string, ModelConfigItem> = {};

  if (!userId) {
    for (const modelId in allModels) {
      if (
        freeModelIds.has(modelId) ||
        alwaysEnabledProviders.has(allModels[modelId].provider)
      ) {
        filteredModels[modelId] = allModels[modelId];
      }
    }
    
    if (userModelCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cacheTimestamps.keys().next().value;
      userModelCache.delete(oldestKey);
      cacheTimestamps.delete(oldestKey);
    }
    
    userModelCache.set(cacheKey, filteredModels);
    cacheTimestamps.set(cacheKey, Date.now());
    
    return filteredModels;
  }

  try {
    const database = Database.getInstance(env);
    const userProviderSettings = await database.getUserProviderSettings(userId);

    const enabledProviders = new Map(
      userProviderSettings
        .filter((p) => p.enabled)
        .map((p) => [p.provider_id, true]),
    );

    for (const modelId in allModels) {
      const model = allModels[modelId];
      const isFree = freeModelIds.has(modelId);
      const isEnabled =
        alwaysEnabledProviders.has(model.provider) ||
        enabledProviders.has(model.provider);

      if (isFree || isEnabled) {
        filteredModels[modelId] = model;
      }
    }

    if (userModelCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cacheTimestamps.keys().next().value;
      userModelCache.delete(oldestKey);
      cacheTimestamps.delete(oldestKey);
    }

    userModelCache.set(cacheKey, filteredModels);
    cacheTimestamps.set(cacheKey, Date.now());

    return filteredModels;
  } catch (error) {
    logger.error(`Error during model filtering for user ${userId}`, { error });
    return freeModels;
  }
}

/**
 * Get the appropriate model to use for auxiliary tasks like summarization,
 * classification, etc., based on which models are available.
 * @param env The environment object
 * @param user Optional user for model access check
 * @returns Object containing model ID and provider
 */
export async function getAuxiliaryModel(
  env: IEnv,
  user?: IUser,
): Promise<{ model: string; provider: string }> {
  let modelToUse = "gemma-3-12b-it";

  const allRouterModels = getIncludedInRouterModels();
  const availableModels = await filterModelsForUserAccess(
    allRouterModels,
    env,
    user?.id,
  );

  const hasGroqModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "groq",
  );

  if (hasGroqModel) {
    modelToUse = "llama-3.3-70b-versatile";
  }

  const modelConfig = getModelConfig(modelToUse);

  return { model: modelConfig.matchingModel, provider: modelConfig.provider };
}

export const getAuxiliaryModelForRetrieval = async (
  env: IEnv,
  user?: IUser,
) => {
  let modelToUse = "gemma-3-12b-it";

  const allRouterModels = getIncludedInRouterModels();
  const availableModels = await filterModelsForUserAccess(
    allRouterModels,
    env,
    user?.id,
  );

  const hasPerplexityModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "perplexity-ai",
  );

  if (hasPerplexityModel) {
    modelToUse = "sonar";
  }

  const modelConfig = getModelConfig(modelToUse);

  return { model: modelConfig.matchingModel, provider: modelConfig.provider };
};

export const getAuxiliaryGuardrailsModel = async (env: IEnv, user?: IUser) => {
  let modelToUse = "@cf/meta/llama-guard-3-8b";

  const allRouterModels = getIncludedInRouterModels();
  const availableModels = await filterModelsForUserAccess(
    allRouterModels,
    env,
    user?.id,
  );

  const hasGroqModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "groq",
  );

  if (hasGroqModel) {
    modelToUse = "llama-guard-3-8b";
  }

  const provider = getModelConfig(modelToUse).provider;

  return { model: modelToUse, provider };
};
