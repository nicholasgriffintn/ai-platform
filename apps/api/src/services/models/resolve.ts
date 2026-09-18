import {
  findModelConfigByMatchingModel,
  getFreeModels,
  getLineupFreeModels,
  getLineupModels,
  getModelConfigById,
  getModels,
  resolveDefaultChatModel,
  resolvePolicyModel,
  getExecutableModelsForAccount,
} from "@ngriffin_uk/polychat-ai-models";
import { isProviderPlatformEnabled } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  agentModelConfig,
  getSystemModelLineup,
  isMachineOnline,
  type ModelConfigItem,
  type SystemModelRole,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { KVCache } from "~/lib/cache";
import { RepositoryManager } from "~/repositories";
import {
  findTrainingDeploymentModelConfig,
  getTrainingDeploymentModelConfigs,
} from "~/services/models/training-deployments";
import type { IEnv, IUser, IUserSettings, ResearchProviderName, SearchProviderName } from "~/types";

const logger = getLogger({ prefix: "services/models/resolve" });

export interface ModelAccessOptions {
  shouldUseCache?: boolean;
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

async function findMachineModelConfig(
  modelId: string,
  env: IEnv | undefined,
  userId: number | undefined,
  provider?: string,
): Promise<ModelConfigItem | null> {
  if (!env?.DB || !userId || !modelId.startsWith("machine/")) {
    return null;
  }

  const [, machineId, runtimeVendor, ...nativeIdParts] = modelId.split("/");
  const nativeId = nativeIdParts.join("/");

  if (!machineId || !runtimeVendor || !nativeId || (provider && provider !== runtimeVendor)) {
    return null;
  }

  const machine = (await new RepositoryManager(env).machines.listForUser(userId)).find(
    (candidate) => candidate.machineId === machineId && isMachineOnline(candidate),
  );

  if (!machine) {
    return null;
  }

  for (const runtime of machine.runtimes) {
    if (runtime.vendor !== runtimeVendor) {
      continue;
    }

    if (runtime.kind === "agent") {
      const base = agentModelConfig[`agent/${runtime.vendor}`];

      if (
        nativeId !== runtime.vendor ||
        runtime.readiness.state !== "ready" ||
        !runtime.supportsSessions ||
        !machine.capabilities.includes("agent-run") ||
        !base
      ) {
        continue;
      }

      return {
        ...base,
        id: modelId,
        machineId,
        isExecutable: true,
        description: `Runs on ${machine.label} through ${base.name ?? runtime.vendor}.`,
      };
    }

    const model = runtime.models.find((candidate) => candidate.nativeId === nativeId);

    if (
      runtime.readiness.status !== "ready" ||
      !machine.capabilities.includes("model-relay") ||
      !model
    ) {
      continue;
    }

    return {
      id: modelId,
      name: model.displayName,
      matchingModel: model.nativeId,
      provider: runtime.vendor,
      runsOn: "device",
      machineId,
      description: `Runs on ${machine.label} through ${runtime.vendor}.`,
      contextWindow: model.contextTokens ?? undefined,
      multimodal: false,
      supportsToolCalls: false,
      supportsAttachments: false,
      modalities: { input: ["text"], output: ["text"] },
      isExecutable: true,
      isFeatured: false,
      isPlatformEnabled: true,
    };
  }

  return null;
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
  options: ModelAccessOptions,
): Promise<Record<string, ModelConfigItem>> {
  if (!userId || !options.includeTrainingDeployments) {
    return models;
  }

  return {
    ...models,
    ...(await getTrainingDeploymentModelConfigs(env, userId)),
  };
}

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
    const config = getModelConfigById(key);

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

  const machineConfig = await findMachineModelConfig(model, env, userId, provider);

  if (machineConfig) {
    return machineConfig;
  }

  return findTrainingDeploymentModelConfig(model, env, userId, provider);
}

export async function getModelConfigByModel(model: string, env?: IEnv) {
  return withCache(env, "model-by-model", [model], () => getModelConfigById(model));
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
    const matchedModel =
      (await getModelConfigByModel(model, env)) ||
      (await getModelConfigByMatchingModel(model, env, provider));

    if (matchedModel?.provider) {
      return matchedModel.provider;
    }
  }

  return provider || defaultProvider;
}

export async function getLineupModelsForUser(
  env: IEnv,
  user?: IUser,
  options: ModelAccessOptions = {
    shouldUseCache: true,
  },
): Promise<Record<string, ModelConfigItem>> {
  if (!user?.id) {
    const visibleModels = await filterModelsForUserAccess(
      getLineupFreeModels(),
      env,
      undefined,
      options,
    );

    return getExecutableModelsForAccount(visibleModels, user);
  }

  const lineupModels = getLineupModels();
  const visibleModels = await filterModelsForUserAccess(lineupModels, env, user.id, options);

  return getExecutableModelsForAccount(visibleModels, user);
}

export async function getDefaultChatModel(
  env: IEnv,
  user?: IUser,
): Promise<{ model: string; provider: string }> {
  const availableModels = await getLineupModelsForUser(env, user, {
    shouldUseCache: false,
  });
  const selected = resolveDefaultChatModel(availableModels, user);

  return { model: selected.id, provider: selected.config.provider };
}

export async function filterModelsForUserAccess(
  allModels: Record<string, ModelConfigItem>,
  env: IEnv,
  userId?: number,
  options: ModelAccessOptions = { shouldUseCache: true },
): Promise<Record<string, ModelConfigItem>> {
  const allFreeModels = getFreeModels();

  const freeModels: Record<string, ModelConfigItem> = {};

  for (const modelId in allFreeModels) {
    const model = allFreeModels[modelId];

    if (isProviderPlatformEnabled(model.provider, env)) {
      freeModels[modelId] = model;
    }
  }

  const freeModelIds = new Set(Object.keys(freeModels));

  const filteredModels: Record<string, ModelConfigItem> = {};

  if (!userId) {
    for (const modelId in allModels) {
      if (
        freeModelIds.has(modelId) ||
        isProviderPlatformEnabled(allModels[modelId].provider, env)
      ) {
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
      const isPlatformEnabled = isProviderPlatformEnabled(model.provider, env);
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
        return freeModelIds.has(modelId) && isProviderPlatformEnabled(model.provider, env);
      }),
    );
  }
}

async function resolveSystemModel(env: IEnv, user: IUser | undefined, role: SystemModelRole) {
  const availableModels = await getLineupModelsForUser(env, user);
  const lineup = getSystemModelLineup(role);
  const selected =
    resolvePolicyModel(availableModels, lineup.candidates, user) ??
    resolveDefaultChatModel(availableModels, user);

  return { model: selected.config.matchingModel, provider: selected.config.provider };
}

export async function getAuxiliaryModel(
  env: IEnv,
  user?: IUser,
): Promise<{ model: string; provider: string }> {
  return resolveSystemModel(env, user, "housekeeping");
}

export const getTitlingModel = async (env: IEnv, user?: IUser) =>
  resolveSystemModel(env, user, "titling");

export const getCompactionModel = async (env: IEnv, user?: IUser) =>
  resolveSystemModel(env, user, "compaction");

export const getAuxiliaryModelForRetrieval = async (env: IEnv, user?: IUser) =>
  resolveSystemModel(env, user, "retrieval");

export const getAuxiliaryGuardrailsModel = async (env: IEnv, user?: IUser) => {
  const visibleModels = await filterModelsForUserAccess(getModels(), env, user?.id, {
    shouldUseCache: false,
  });
  const selected = resolvePolicyModel(
    visibleModels,
    getSystemModelLineup("guardrails").candidates,
    user,
  );

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

  const transcriptionConfig = await getModelConfig(transcriptionModel, env);

  return {
    model: transcriptionConfig.matchingModel,
    provider: transcriptionConfig.provider,
    transcriptionProvider,
  };
};
