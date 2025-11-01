import { KVCache } from "~/lib/cache";
import { Database } from "~/lib/database";
import type {
  IEnv,
  IUser,
  IUserSettings,
  ModelConfig,
  ModelConfigItem,
  SearchProviderName,
} from "~/types";
import { getLogger } from "~/utils/logger";
import { anthropicModelConfig } from "./anthropic";
import { azureModelConfig } from "./azure";
import { bedrockModelConfig } from "./bedrock";
import { chutesModelConfig } from "./chutes";
import {
  type availableCapabilities,
  type availableModelTypes,
  defaultModel,
} from "./constants";
import { deepinfraModelConfig } from "./deepinfra";
import { deepseekModelConfig } from "./deepseek";
import { fireworksModelConfig } from "./fireworks";
import { githubCopilotModelConfig } from "./githubcopilot";
import { githubModelsConfig } from "./githubmodels";
import { googleAiStudioModelConfig } from "./google-ai-studio";
import { groqModelConfig } from "./groq";
import { huggingfaceModelConfig } from "./huggingface";
import { hyperbolicModelConfig } from "./hyperbolic";
import { inceptionModelConfig } from "./inception";
import { inferenceModelConfig } from "./inference";
import { mistralModelConfig } from "./mistral";
import { morphModelConfig } from "./morph";
import { ollamaModelConfig } from "./ollama";
import { openaiModelConfig } from "./openai";
import { openrouterModelConfig } from "./openrouter";
import { parallelModelConfig } from "./parallel";
import { perplexityModelConfig } from "./perplexity";
import { replicateModelConfig } from "./replicate";
import { requestyModelConfig } from "./requesty";
import { togetherAiModelConfig } from "./together-ai";
import { upstageModelConfig } from "./upstage";
import { v0ModelConfig } from "./v0";
import { vercelModelConfig } from "./vercel";
import { workersAiModelConfig } from "./workersai";
import { xaiModelConfig } from "./xai";
import { AssistantError, ErrorType } from "~/utils/errors";

const logger = getLogger({ prefix: "lib/models" });

let cachedModels: typeof modelConfig | null = null;
let cachedFreeModels: typeof modelConfig | null = null;
let cachedFeaturedModels: typeof modelConfig | null = null;
let cachedRouterModels: typeof modelConfig | null = null;

export interface ModelsOptions {
  shouldUseCache?: boolean;
  excludeTypes?: Array<(typeof availableModelTypes)[number]>;
}

const modelConfig: ModelConfig = {
  ...openaiModelConfig,
  ...anthropicModelConfig,
  ...mistralModelConfig,
  ...morphModelConfig,
  ...ollamaModelConfig,
  ...bedrockModelConfig,
  ...deepinfraModelConfig,
  ...deepseekModelConfig,
  ...azureModelConfig,
  ...githubModelsConfig,
  ...xaiModelConfig,
  ...groqModelConfig,
  ...huggingfaceModelConfig,
  ...openrouterModelConfig,
  ...parallelModelConfig,
  ...perplexityModelConfig,
  ...requestyModelConfig,
  ...workersAiModelConfig,
  ...togetherAiModelConfig,
  ...googleAiStudioModelConfig,
  ...fireworksModelConfig,
  ...hyperbolicModelConfig,
  ...inferenceModelConfig,
  ...chutesModelConfig,
  ...vercelModelConfig,
  ...upstageModelConfig,
  ...githubCopilotModelConfig,
  ...inceptionModelConfig,
  ...v0ModelConfig,
  ...replicateModelConfig,
};

const MODEL_CACHE_TTL = 14400;
const USER_MODEL_CACHE_TTL = 3600;
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

/**
 * Generic caching helper that handles cache read/write operations
 */
async function withCache<T>(
  env: IEnv | undefined,
  cacheKeyPrefix: string,
  cacheKeyParts: string[],
  computeFn: () => T | Promise<T>,
): Promise<T> {
  if (!env?.CACHE) {
    return computeFn();
  }

  const cache = getModelCache(env);
  if (!cache) {
    return computeFn();
  }

  const cacheKey = KVCache.createKey(cacheKeyPrefix, ...cacheKeyParts);

  const cached = await cache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const result = await computeFn();

  if (result !== null && result !== undefined) {
    cache.set(cacheKey, result).catch(() => {});
  }

  return result;
}

export async function getModelConfig(model?: string, env?: IEnv) {
  const key = model || defaultModel;

  return withCache(
    env,
    "model-config",
    [key],
    () => (model && modelConfig[model]) || modelConfig[defaultModel],
  );
}

export async function getModelConfigByModel(model: string, env?: IEnv) {
  return withCache(
    env,
    "model-by-model",
    [model],
    () => model && modelConfig[model as keyof typeof modelConfig],
  );
}

export async function getMatchingModel(
  model: string = defaultModel,
  env?: IEnv,
) {
  return withCache(env, "matching-model", [model], async () => {
    const config = await getModelConfig(model, env);
    return config?.matchingModel;
  });
}

export async function getModelConfigByMatchingModel(
  matchingModel: string,
  env?: IEnv,
) {
  return withCache(env, "model-by-matching", [matchingModel], () => {
    for (const model in modelConfig) {
      if (
        modelConfig[model as keyof typeof modelConfig].matchingModel ===
        matchingModel
      ) {
        return modelConfig[model as keyof typeof modelConfig];
      }
    }
    return null;
  });
}

export function getModels(
  options: ModelsOptions = {
    shouldUseCache: true,
    excludeTypes: [],
  },
) {
  if (cachedModels && options.shouldUseCache) {
    return cachedModels;
  }

  cachedModels = Object.entries(modelConfig).reduce((acc, [key, model]) => {
    if (
      !model.beta &&
      !options.excludeTypes?.some((excluded) => model.type.includes(excluded))
    ) {
      acc[key] = model;
    }
    return acc;
  }, {});

  return cachedModels;
}

export function getFreeModels(
  options: ModelsOptions = {
    shouldUseCache: true,
  },
) {
  if (cachedFreeModels && options.shouldUseCache) {
    return cachedFreeModels;
  }

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

export function getFeaturedModels(
  options: ModelsOptions = {
    shouldUseCache: true,
  },
) {
  if (cachedFeaturedModels && options.shouldUseCache) {
    return cachedFeaturedModels;
  }

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

export function getIncludedInRouterModels(
  options: ModelsOptions = {
    shouldUseCache: true,
  },
) {
  if (cachedRouterModels && options.shouldUseCache) {
    return cachedRouterModels;
  }

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

export function getIncludedInRouterFreeModels(
  options: ModelsOptions = {
    shouldUseCache: true,
  },
) {
  return Object.entries(getIncludedInRouterModels(options)).reduce(
    (acc, [key, model]) => {
      if (model.isFree) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export async function getIncludedInRouterModelsForUser(
  env: IEnv,
  userId?: number,
  options: ModelsOptions = {
    shouldUseCache: true,
  },
): Promise<Record<string, ModelConfigItem>> {
  if (!userId) {
    const freeModels = getIncludedInRouterFreeModels(options);
    return await filterModelsForUserAccess(freeModels, env, userId, options);
  }

  const database = Database.getInstance(env);
  const user = await database.getUserById(userId);
  const isPro = user?.plan_id === "pro";

  if (!isPro) {
    const freeModels = getIncludedInRouterFreeModels(options);
    return await filterModelsForUserAccess(freeModels, env, userId, options);
  }

  const allRouterModels = getIncludedInRouterModels(options);
  return await filterModelsForUserAccess(allRouterModels, env, userId, options);
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
  options: ModelsOptions = { shouldUseCache: true },
): Promise<Record<string, ModelConfigItem>> {
  const cache = getUserModelCache(env);
  const cacheKey = KVCache.createKey(
    "user-models",
    userId?.toString() || "anonymous",
  );

  if (cache && options.shouldUseCache) {
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

    if (cache && options.shouldUseCache) {
      cache.set(cacheKey, filteredModels).catch(() => {});
    }

    return filteredModels;
  }

  try {
    const database = Database.getInstance(env);

    const userProviderSettings = await withCache(
      env,
      "user-provider-settings",
      [userId.toString()],
      () => database.getUserProviderSettings(userId),
    );

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

  const availableModels = await getIncludedInRouterModelsForUser(env, user?.id);

  const hasGroqModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "groq",
  );

  if (hasGroqModel) {
    modelToUse = "llama-3.3-70b-versatile";
    return { model: modelToUse, provider: "groq" };
  }

  const modelConfig = await getModelConfig(modelToUse, env);

  return { model: modelConfig.matchingModel, provider: modelConfig.provider };
}

export const getAuxiliaryModelForRetrieval = async (
  env: IEnv,
  user?: IUser,
) => {
  let modelToUse = "gemma-3-12b-it";

  const availableModels = await getIncludedInRouterModelsForUser(env, user?.id);

  const hasPerplexityModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "perplexity-ai",
  );

  if (hasPerplexityModel) {
    modelToUse = "sonar";
  }

  const modelConfig = await getModelConfig(modelToUse, env);

  return { model: modelConfig.matchingModel, provider: modelConfig.provider };
};

export const getAuxiliaryGuardrailsModel = async (env: IEnv, user?: IUser) => {
  let modelToUse = "@cf/meta/llama-guard-3-8b";

  const availableModels = await getIncludedInRouterModelsForUser(env, user?.id);

  const hasGroqModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "groq",
  );

  if (hasGroqModel) {
    modelToUse = "meta-llama/llama-guard-4-12b";
    return { model: modelToUse, provider: "groq" };
  }

  const modelConfig = await getModelConfig(modelToUse, env);
  const provider = modelConfig.provider;

  return { model: modelToUse, provider };
};

export const getAuxiliarySearchProvider = async (
  _env: IEnv,
  user?: IUser,
  requestedProvider?: SearchProviderName,
): Promise<SearchProviderName> => {
  const isProUser = user?.plan_id === "pro";

  if (!isProUser) {
    throw new AssistantError(
      "Web search is only available for Pro users right now.",
      ErrorType.AUTHORISATION_ERROR,
    );
  }

  if (requestedProvider) {
    return requestedProvider;
  }

  return "tavily";
};

export const getAuxiliarySpeechModel = async (
  env: IEnv,
  userSettings?: IUserSettings,
): Promise<{
  model: string;
  provider: string;
  transcriptionProvider: string;
}> => {
  const transcriptionProvider =
    userSettings?.transcription_provider || "workers";
  const transcriptionModel = userSettings?.transcription_model || "whisper";

  const modelConfig = await getModelConfig(transcriptionModel, env);

  return {
    model: modelConfig.matchingModel,
    provider: modelConfig.provider,
    transcriptionProvider,
  };
};

export {
  availableCapabilities,
  availableModelTypes,
  defaultModel,
  defaultProvider,
} from "./constants";
