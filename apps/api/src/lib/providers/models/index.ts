import { MODEL_DEFAULTS, isActiveRouterModel } from "@ngriffin_uk/polychat-schemas";
import type {
  ModelConfigItem,
  ModelModalities,
  ModelModality,
} from "@ngriffin_uk/polychat-schemas";

import type { availableModalities } from "~/constants/models";
import { KVCache } from "~/lib/cache";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IUser, IUserSettings, ResearchProviderName, SearchProviderName } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import { modelConfig } from "./catalogue";
import {
  getExecutableModelsForAccount,
  resolveDefaultChatModel,
  resolvePolicyModel,
} from "./policy";
import {
  findTrainingDeploymentModelConfig,
  getTrainingDeploymentModelConfigs,
} from "./trainingDeployments";

const logger = getLogger({ prefix: "lib/models" });

let cachedModels: typeof modelConfig | null = null;
let cachedFreeModels: typeof modelConfig | null = null;
let cachedFeaturedModels: typeof modelConfig | null = null;
let cachedRouterModels: typeof modelConfig | null = null;
let cachedCapabilities: string[] | null = null;

export interface ModelsOptions {
  shouldUseCache?: boolean;
  excludeModalities?: ModelModality[];
  includeTrainingDeployments?: boolean;
}

export interface ResolveModelProviderOptions {
  model?: string;
  provider?: string;
  defaultProvider: string;
  env?: IEnv;
}

const MODEL_CACHE_TTL = 14400;
let modelCache: KVCache | null = null;

const DEFAULT_MODALITIES: ModelModalities = {
  input: ["text"],
  output: ["text"],
};

function findModelConfigByMatchingModel(matchingModel: string, provider?: string) {
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

function getModelModalities(model: ModelConfigItem): ModelModalities {
  return model.modalities ?? DEFAULT_MODALITIES;
}

function modelSupportsModality(model: ModelConfigItem, modality: ModelModality) {
  const modalities = getModelModalities(model);

  return modalities.input.includes(modality) || modalities.output.includes(modality);
}

function getModelCache(env: IEnv): KVCache | null {
  if (!env.CACHE) {
    return null;
  }

  if (!modelCache) {
    modelCache = new KVCache(env.CACHE, MODEL_CACHE_TTL);
  }

  return modelCache;
}

async function withTrainingDeploymentModels(
  models: Record<string, ModelConfigItem>,
  env: IEnv,
  userId: number | undefined,
  options: ModelsOptions,
): Promise<Record<string, ModelConfigItem>> {
  if (!userId || !options.includeTrainingDeployments) {
    return models;
  }

  return {
    ...models,
    ...(await getTrainingDeploymentModelConfigs(env, userId)),
  };
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

export async function getModelConfig(
  model?: string,
  env?: IEnv,
  provider?: string,
  userId?: number,
) {
  if (!model) {
    return undefined;
  }

  const key = model;
  const resolvedProvider = provider;
  const cacheParts = resolvedProvider ? [key, resolvedProvider] : [key];

  const staticConfig = await withCache(env, "model-config", cacheParts, () => {
    const config = modelConfig[key];

    if (config && (!resolvedProvider || config.provider === resolvedProvider)) {
      return config;
    }

    if (resolvedProvider) {
      return findModelConfigByMatchingModel(key, resolvedProvider) ?? undefined;
    }

    return config;
  });

  if (staticConfig || !model) {
    return staticConfig;
  }

  return findTrainingDeploymentModelConfig(model, env, userId, provider);
}

export async function getModelConfigByModel(model: string, env?: IEnv) {
  return withCache(env, "model-by-model", [model], () => model && modelConfig[model]);
}

export async function getModelConfigByMatchingModel(
  matchingModel: string,
  env?: IEnv,
  provider?: string,
  userId?: number,
) {
  const resolvedProvider = provider;
  const cacheParts = resolvedProvider ? [matchingModel, resolvedProvider] : [matchingModel];
  const staticConfig = await withCache(
    env,
    "model-by-matching",
    cacheParts,
    () => findModelConfigByMatchingModel(matchingModel, resolvedProvider) ?? null,
  );

  if (staticConfig) {
    return staticConfig;
  }

  return findTrainingDeploymentModelConfig(matchingModel, env, userId, resolvedProvider);
}

export async function findModelConfig(
  model: string,
  env?: IEnv,
  provider?: string,
  userId?: number,
): Promise<ModelConfigItem | null> {
  return (
    (await getModelConfig(model, env, provider, userId)) ||
    (await getModelConfigByMatchingModel(model, env, provider, userId)) ||
    null
  );
}

export async function resolveModelConfig(
  model: string,
  env?: IEnv,
  provider?: string,
  userId?: number,
): Promise<ModelConfigItem> {
  const resolvedConfig = await findModelConfig(model, env, provider, userId);

  if (!resolvedConfig) {
    throw new AssistantError(`Model ${model} not found`, ErrorType.PARAMS_ERROR);
  }

  return resolvedConfig;
}

export async function resolveModelProvider({
  model,
  provider,
  defaultProvider,
  env,
}: ResolveModelProviderOptions): Promise<string> {
  if (model) {
    const modelConfig =
      (await getModelConfigByModel(model, env)) ||
      (await getModelConfigByMatchingModel(model, env, provider));

    if (modelConfig?.provider) {
      return modelConfig.provider;
    }
  }

  return provider || defaultProvider;
}

export function getModels(
  options: ModelsOptions = {
    shouldUseCache: true,
    excludeModalities: [],
  },
) {
  if (cachedModels && options.shouldUseCache) {
    return cachedModels;
  }

  cachedModels = Object.entries(modelConfig).reduce((acc, [key, model]) => {
    if (
      !model.beta &&
      !options.excludeModalities?.some((excluded) => modelSupportsModality(model, excluded))
    ) {
      acc[key] = model;
    }

    return acc;
  }, {});

  return cachedModels;
}

export function getAvailableStrengths(): string[] {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const capabilities = new Set<string>();

  for (const model of Object.values(modelConfig)) {
    for (const capability of model.strengths ?? []) {
      capabilities.add(capability);
    }
  }

  cachedCapabilities = Array.from(capabilities);

  return cachedCapabilities;
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
      if (model.isFeatured && !model.deprecated && model.status !== "deprecated") {
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
      if (isActiveRouterModel(model)) {
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
  user?: IUser,
  options: ModelsOptions = {
    shouldUseCache: true,
  },
): Promise<Record<string, ModelConfigItem>> {
  if (!user?.id) {
    const freeModels = getIncludedInRouterFreeModels(options);
    const visibleModels = await filterModelsForUserAccess(freeModels, env, undefined, options);

    return getExecutableModelsForAccount(visibleModels, user);
  }

  const allRouterModels = getIncludedInRouterModels(options);
  const visibleModels = await filterModelsForUserAccess(allRouterModels, env, user.id, options);

  return getExecutableModelsForAccount(visibleModels, user);
}

export async function getDefaultChatModel(
  env: IEnv,
  user?: IUser,
): Promise<{ model: string; provider: string }> {
  const availableModels = await getIncludedInRouterModelsForUser(env, user, {
    shouldUseCache: false,
  });
  const selected = resolveDefaultChatModel(availableModels, user);

  return { model: selected.id, provider: selected.config.provider };
}

export function getModelsByCapability(capability: string) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.strengths?.includes(capability as (typeof availableModalities)[number])) {
        acc[key] = model;
      }

      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getModelsByModality(modality: ModelModality) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (modelSupportsModality(model, modality)) {
        acc[key] = model;
      }

      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getModelsByOutputModality(modality: ModelModality) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      const outputs = model.modalities?.output ?? [];

      if (outputs.includes(modality)) {
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
  const allFreeModels = getFreeModels();
  const alwaysEnabledProvidersEnvVar = env.ALWAYS_ENABLED_PROVIDERS;
  const alwaysEnabledProviders = new Set(alwaysEnabledProvidersEnvVar?.split(",") || []);

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
      if (freeModelIds.has(modelId) || alwaysEnabledProviders.has(allModels[modelId].provider)) {
        filteredModels[modelId] = {
          ...allModels[modelId],
          isPlatformEnabled: true,
        };
      }
    }

    return withTrainingDeploymentModels(filteredModels, env, userId, options);
  }

  try {
    const repositories = new RepositoryManager(env);

    const userProviderSettings = !options.shouldUseCache
      ? await repositories.userSettings.getUserProviderSettings(userId)
      : await withCache(env, "user-provider-settings", [userId.toString()], () =>
          repositories.userSettings.getUserProviderSettings(userId),
        );

    const enabledProviders = new Map(
      userProviderSettings.filter((p) => p.enabled).map((p) => [p.provider_id, p]),
    );

    for (const modelId in allModels) {
      const model = allModels[modelId];
      const isFree = freeModelIds.has(modelId);
      const userProvider = enabledProviders.get(model.provider);
      const isPlatformEnabled = alwaysEnabledProviders.has(model.provider);
      const isEnabled = isPlatformEnabled || Boolean(userProvider);

      if (isFree || isEnabled) {
        filteredModels[modelId] = {
          ...model,
          isByokEnabled: Boolean(userProvider?.hasApiKey),
          isPlatformEnabled,
        };
      }
    }

    return withTrainingDeploymentModels(filteredModels, env, userId, options);
  } catch (error) {
    logger.error(`Error during model filtering for user ${userId}`, { error });

    return Object.fromEntries(
      Object.entries(allModels).filter(([modelId, model]) => {
        return freeModelIds.has(modelId) && alwaysEnabledProviders.has(model.provider);
      }),
    );
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
  const availableModels = await getIncludedInRouterModelsForUser(env, user);
  const selected =
    resolvePolicyModel(availableModels, MODEL_DEFAULTS.auxiliary, user) ??
    resolveDefaultChatModel(availableModels, user);

  return { model: selected.config.matchingModel, provider: selected.config.provider };
}

export const getAuxiliaryModelForRetrieval = async (env: IEnv, user?: IUser) => {
  const availableModels = await getIncludedInRouterModelsForUser(env, user);
  const selected =
    resolvePolicyModel(availableModels, MODEL_DEFAULTS.retrieval, user) ??
    resolveDefaultChatModel(availableModels, user);

  return { model: selected.config.matchingModel, provider: selected.config.provider };
};

export const getAuxiliaryGuardrailsModel = async (env: IEnv, user?: IUser) => {
  const visibleModels = await filterModelsForUserAccess(getModels(), env, user?.id, {
    shouldUseCache: false,
  });
  const selected = resolvePolicyModel(visibleModels, MODEL_DEFAULTS.guardrails, user);

  if (!selected) {
    throw new AssistantError(
      "No active guardrails model is available for this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return { model: selected.config.matchingModel, provider: selected.config.provider };
};

export const getAuxiliarySearchProvider = async (
  env: IEnv,
  user?: IUser,
  requestedProvider?: SearchProviderName,
): Promise<SearchProviderName> => {
  if (requestedProvider === "duckduckgo") {
    return "duckduckgo";
  }

  if (requestedProvider) {
    if (user?.plan_id === "pro") {
      return requestedProvider;
    }

    if (user?.id) {
      const repositories = new RepositoryManager(env);
      const providerKeyId =
        requestedProvider === "perplexity" ? "perplexity-ai" : requestedProvider;
      const hasProviderKey = await repositories.userSettings.hasProviderApiKey(
        user.id,
        providerKeyId,
      );

      if (hasProviderKey) {
        return requestedProvider;
      }
    }

    throw new AssistantError(
      `${requestedProvider} search provider is not configured for this account`,
      ErrorType.AUTHORISATION_ERROR,
    );
  }

  if (user?.id) {
    const repositories = new RepositoryManager(env);
    const userSettings = await withCache(env, "user-settings", [user.id.toString()], () =>
      repositories.userSettings.getUserSettings(user.id),
    );

    const userPreferredProvider = userSettings?.search_provider as SearchProviderName | undefined;

    if (userPreferredProvider) {
      if (user.plan_id === "pro") {
        return userPreferredProvider;
      }

      const providerKeyId =
        userPreferredProvider === "perplexity" ? "perplexity-ai" : userPreferredProvider;
      const hasProviderKey = await repositories.userSettings.hasProviderApiKey(
        user.id,
        providerKeyId,
      );

      if (!hasProviderKey) {
        return "duckduckgo";
      }

      return userPreferredProvider;
    }
  }

  return user?.plan_id === "pro" ? "tavily" : "duckduckgo";
};

export const getAuxiliaryResearchProvider = async (
  env: IEnv,
  user?: IUser,
  requestedProvider?: ResearchProviderName,
): Promise<ResearchProviderName> => {
  const providerToUse = requestedProvider ?? "parallel";

  if (providerToUse !== "parallel" && providerToUse !== "exa") {
    throw new AssistantError(
      `Unsupported research provider: ${providerToUse}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  if (!user?.id) {
    throw new AssistantError(
      "Research tasks require an authenticated user",
      ErrorType.AUTHORISATION_ERROR,
    );
  }

  const repositories = new RepositoryManager(env);

  const providerSettings = await withCache(
    env,
    "user-provider-settings",
    [user.id.toString()],
    () => repositories.userSettings.getUserProviderSettings(user.id),
  );

  const hasProvider = Array.isArray(providerSettings)
    ? providerSettings.some((setting: any) => {
        const isEnabled = Boolean(setting?.enabled);
        const hasApiKey = Boolean(setting?.hasApiKey);
        const isProviderMatch = setting?.provider_id === providerToUse;

        return isProviderMatch && isEnabled && (user.plan_id === "pro" || hasApiKey);
      })
    : false;

  if (!hasProvider) {
    throw new AssistantError(
      `${providerToUse} research provider is not configured for this account`,
      ErrorType.AUTHORISATION_ERROR,
    );
  }

  return providerToUse;
};

export const getAuxiliarySpeechModel = async (
  env: IEnv,
  userSettings?: IUserSettings,
): Promise<{
  model: string;
  provider: string;
  transcriptionProvider: string;
}> => {
  const transcriptionProvider = userSettings?.transcription_provider || "workers";
  const transcriptionModel = userSettings?.transcription_model || "whisper";

  const modelConfig = await getModelConfig(transcriptionModel, env);

  return {
    model: modelConfig.matchingModel,
    provider: modelConfig.provider,
    transcriptionProvider,
  };
};

export { availableModalities } from "~/constants/models";
