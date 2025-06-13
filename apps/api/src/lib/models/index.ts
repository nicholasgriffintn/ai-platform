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
import { KVCache } from "~/lib/cache";
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

const MODEL_CACHE_TTL = 14400; // 4 hours - model configs are mostly static
const USER_MODEL_CACHE_TTL = 3600; // 1 hour - user access, but invalidated when settings change
let modelCache: KVCache | null = null;

function getModelCache(env: IEnv): KVCache | null {
  if (!env.CACHE) return null;
  
  if (!modelCache) {
    modelCache = new KVCache(env.CACHE, MODEL_CACHE_TTL);
  }
  return modelCache;
}

function getUserModelCache(env: IEnv): KVCache | null {
  if (!env.CACHE) return null;
  
  return new KVCache(env.CACHE, USER_MODEL_CACHE_TTL);
}

export function getModelConfig(model?: string, env?: IEnv) {
  const key = model || defaultModel;
  const config = (model && modelConfig[model]) || modelConfig[defaultModel];
  
  if (env?.CACHE) {
    const cache = getModelCache(env);
    if (cache) {
      const cacheKey = KVCache.createKey("model-config", key);

      cache.set(cacheKey, config).catch(() => {
      });
    }
  }
  
  return config;
}

export function getModelConfigByModel(model: string, env?: IEnv) {
  const config = model && modelConfig[model as keyof typeof modelConfig];
  
  if (env?.CACHE && config) {
    const cache = getModelCache(env);
    if (cache) {
      const cacheKey = KVCache.createKey("model-by-model", model);
      cache.set(cacheKey, config).catch(() => {});
    }
  }
  
  return config;
}

export function getMatchingModel(model: string = defaultModel, env?: IEnv) {
  const matchingModel = model && getModelConfig(model, env).matchingModel;
  
  if (env?.CACHE && matchingModel) {
    const cache = getModelCache(env);
    if (cache) {
      const cacheKey = KVCache.createKey("matching-model", model);
      cache.set(cacheKey, matchingModel).catch(() => {});
    }
  }
  
  return matchingModel;
}

export function getModelConfigByMatchingModel(matchingModel: string, env?: IEnv) {
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
  
  if (env?.CACHE && result) {
    const cache = getModelCache(env);
    if (cache) {
      const cacheKey = KVCache.createKey("model-by-matching", matchingModel);
      cache.set(cacheKey, result).catch(() => {});
    }
  }
  
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
  const cache = getUserModelCache(env);
  const cacheKey = KVCache.createKey("user-models", userId?.toString() || 'anonymous');
  
  if (cache) {
    const cached = await cache.get<Record<string, ModelConfigItem>>(cacheKey);
    if (cached) {
      return cached;
    }
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
    
    if (cache) {
      cache.set(cacheKey, filteredModels).catch(() => {});
    }
    
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

    if (cache) {
      cache.set(cacheKey, filteredModels).catch(() => {});
    }

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

  const modelConfig = getModelConfig(modelToUse, env);

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

  const modelConfig = getModelConfig(modelToUse, env);

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

  const provider = getModelConfig(modelToUse, env).provider;

  return { model: modelToUse, provider };
};
