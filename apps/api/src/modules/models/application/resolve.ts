import {
  findModelConfigByMatchingModel,
  getFreeModels,
  getLineupFreeModels,
  getLineupModels,
  getModelConfigById,
  getModels,
  getModelsByOutputModality,
  getExecutableModelsForAccount,
  rankPolicyModelsByMediaScore,
  readMediaScore,
  resolveDefaultChatModel,
  resolvePolicyModel,
  resolveTierModel,
  TEXT_TO_SPEECH_ARENA_SCORE,
} from "@ngriffin_uk/polychat-ai-models";
import {
  isProviderPlatformEnabled,
  selectRerankingModel,
  isModelRuntimeAvailable,
  type RerankingModelSelection,
} from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  searchProviderSchema,
  getModelDisplayName,
  getSystemModelLineup,
  speechProviderSchema,
  modelHasInputModalities,
  type ModelConfigItem,
  type ModelModality,
  type ModelTier,
  type ModelTierRole,
  type ReasoningEffort,
  type SpeechProvider,
  type SystemModelRole,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { KVCache } from "~/infrastructure/cache";
import {
  isProviderQuotaBlocked,
  parseProviderQuotaState,
} from "~/modules/user/domain/provider-quota";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IUser, IUserSettings, ResearchProviderName, SearchProviderName } from "~/types";

import { findSourcedModel, findSourcedModelByMatchingModel, listSourcedModels } from "./sources";

const logger = getLogger({ prefix: "services/models/resolve" });

export interface ModelAccessOptions {
  shouldUseCache?: boolean;
  includePlatformModels?: boolean;
}

export interface ResolveModelProviderOptions {
  model?: string;
  provider?: string;
  defaultProvider: string;
  env?: IEnv;
}

export interface ResolvedSystemModel {
  id?: string;
  model: string;
  provider: string;
  effort?: ReasoningEffort;
}

const MODEL_CACHE_TTL = 14400;
let modelCache: KVCache | null = null;

function getModelCache(env: IEnv): KVCache | null {
  if (!env.CACHE) {
    return null;
  }

  if (!modelCache) {
    modelCache = new KVCache(env.CACHE, MODEL_CACHE_TTL);
  }

  return modelCache;
}

async function withPlatformModels(
  models: Record<string, ModelConfigItem>,
  env: IEnv,
  userId: number | undefined,
  options: ModelAccessOptions,
): Promise<Record<string, ModelConfigItem>> {
  if (!userId || !options.includePlatformModels) {
    return models;
  }

  return {
    ...models,
    ...(await listSourcedModels(env, userId)),
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

  const staticConfig = findStaticModelConfig(model, provider);

  if (staticConfig) {
    return staticConfig;
  }

  return findSourcedModel(model, { env, userId, provider });
}

function findStaticModelConfig(model: string, provider?: string): ModelConfigItem | undefined {
  const config = getModelConfigById(model);

  if (config && (!provider || config.provider === provider)) {
    return config;
  }

  if (provider) {
    return findModelConfigByMatchingModel(model, provider) ?? undefined;
  }

  return config;
}

export async function getModelConfigByModel(model: string) {
  return getModelConfigById(model);
}

export async function getModelConfigByMatchingModel(
  matchingModel: string,
  env?: IEnv,
  provider?: string,
  userId?: number,
) {
  const staticConfig = findModelConfigByMatchingModel(matchingModel, provider);

  if (staticConfig) {
    return staticConfig;
  }

  return findSourcedModelByMatchingModel(matchingModel, { env, userId, provider });
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
      (await getModelConfigByModel(model)) ||
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

    return withPlatformModels(filteredModels, env, userId, options);
  }

  try {
    const userProviderSettings = !options.shouldUseCache
      ? await new UserSettingsRepository(env).getUserProviderSettings(userId)
      : await withCache(env, "user-provider-settings", [userId.toString()], () =>
          new UserSettingsRepository(env).getUserProviderSettings(userId),
        );

    const enabledProviders = new Map(
      userProviderSettings.filter((p) => p.enabled).map((p) => [p.provider_id, p]),
    );
    const now = new Date();
    const outOfCreditProviders = new Set(
      userProviderSettings
        .filter((p) => isProviderQuotaBlocked(parseProviderQuotaState(p.quota), now))
        .map((p) => p.provider_id),
    );

    for (const modelId in allModels) {
      const model = allModels[modelId];

      if (outOfCreditProviders.has(model.provider)) {
        continue;
      }

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

    return withPlatformModels(filteredModels, env, userId, options);
  } catch (error) {
    logger.error(`Error during model filtering for user ${userId}`, { error });

    return Object.fromEntries(
      Object.entries(allModels).filter(([modelId, model]) => {
        return freeModelIds.has(modelId) && isProviderPlatformEnabled(model.provider, env);
      }),
    );
  }
}

type ChatSystemModelRole = "housekeeping" | "titling" | "compaction" | "retrieval";

const MODALITY_SYSTEM_ROLE_MODALITIES: Partial<Record<SystemModelRole, ModelModality>> = {
  guardrails: "guardrails",
  decision: "decision",
  extraction: "extraction",
  reranking: "reranking",
  transcription: "transcription",
  ocr: "ocr",
  image: "image",
  video: "video",
  music: "audio",
};

const CAPABILITY_SYSTEM_ROLE_KEYS: Partial<Record<SystemModelRole, keyof ModelConfigItem>> = {
  fim: "supportsFim",
  nextEdit: "supportsNextEdit",
  applyEdit: "supportsApplyEdit",
};

async function resolveSystemModel(
  env: IEnv,
  user: IUser | undefined,
  role: ChatSystemModelRole,
): Promise<ResolvedSystemModel> {
  const availableModels = await getLineupModelsForUser(env, user);
  const lineup = getSystemModelLineup(role);
  const candidate = resolvePolicyModel(availableModels, lineup.candidates, user);
  const selected = candidate ?? resolveDefaultChatModel(availableModels, user);

  return {
    model: selected.config.matchingModel,
    provider: selected.config.provider,
    effort: candidate?.effort,
  };
}

async function resolveModalitySystemModel(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
  options: ModelAccessOptions = {},
  inputs: readonly ModelModality[] = [],
): Promise<ResolvedSystemModel | null> {
  const modality = MODALITY_SYSTEM_ROLE_MODALITIES[role];

  if (!modality) {
    return null;
  }

  const candidates = getSystemModelLineup(role).candidates;
  const accessibleModels = await filterModelsForUserAccess(
    getModelsByOutputModality(modality),
    env,
    user?.id,
    { shouldUseCache: true, ...options },
  );
  const executableModels = getExecutableModelsForAccount(accessibleModels, user);
  const availableModels = Object.fromEntries(
    Object.entries(executableModels).filter(
      ([, model]) => isModelRuntimeAvailable(model, env) && modelHasInputModalities(model, inputs),
    ),
  );
  const selected = resolvePolicyModel(availableModels, candidates, user);

  return selected
    ? {
        id: selected.id,
        model: selected.config.matchingModel,
        provider: selected.config.provider,
        effort: selected.effort,
      }
    : null;
}

async function resolveCapabilitySystemModel(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
): Promise<ResolvedSystemModel | null> {
  const capability = CAPABILITY_SYSTEM_ROLE_KEYS[role];

  if (!capability) {
    return null;
  }

  const candidates = getSystemModelLineup(role).candidates;
  const accessibleModels = await filterModelsForUserAccess(getModels(), env, user?.id);
  const executableModels = getExecutableModelsForAccount(accessibleModels, user);
  const availableModels = Object.fromEntries(
    Object.entries(executableModels).filter(
      ([, model]) => isModelRuntimeAvailable(model, env) && Boolean(model[capability]),
    ),
  );
  const selected = resolvePolicyModel(availableModels, candidates, user);

  return selected
    ? {
        model: selected.config.matchingModel,
        provider: selected.config.provider,
        effort: selected.effort,
      }
    : null;
}

export async function getSystemModel(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
): Promise<ResolvedSystemModel | null> {
  if (
    role === "housekeeping" ||
    role === "titling" ||
    role === "compaction" ||
    role === "retrieval"
  ) {
    return resolveSystemModel(env, user, role);
  }

  if (role === "guardrails") {
    return getAuxiliaryGuardrailsModel(env, user);
  }

  if (role === "decision") {
    return getAuxiliaryDecisionModel(env, user);
  }

  if (role === "reranking") {
    return resolveRerankingModel(env, user);
  }

  if (role === "speech") {
    const speech = await getSpeechModel(env, user).catch(() => null);

    return speech && { id: speech.id, model: speech.model, provider: speech.provider };
  }

  if (role === "transcription") {
    const transcription = await getAuxiliarySpeechModel(env, undefined, user);

    return {
      model: transcription.model,
      provider: transcription.provider,
    };
  }

  if (CAPABILITY_SYSTEM_ROLE_KEYS[role]) {
    return resolveCapabilitySystemModel(env, user, role);
  }

  return resolveModalitySystemModel(env, user, role);
}

export async function getTierModel(
  env: IEnv,
  user: IUser,
  tier: ModelTier,
  role: ModelTierRole = "agent",
): Promise<ResolvedSystemModel> {
  const selected = resolveTierModel(await getLineupModelsForUser(env, user), user, tier, role);

  if (!selected) {
    throw new AssistantError(
      `No model in the ${tier} tier is available for this account`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return {
    id: selected.id,
    model: selected.config.matchingModel,
    provider: selected.config.provider,
    effort: selected.effort,
  };
}

export async function getAuxiliaryModel(env: IEnv, user?: IUser): Promise<ResolvedSystemModel> {
  return resolveSystemModel(env, user, "housekeeping");
}

export const getTitlingModel = async (env: IEnv, user?: IUser) =>
  resolveSystemModel(env, user, "titling");

export const getCompactionModel = async (env: IEnv, user?: IUser) =>
  resolveSystemModel(env, user, "compaction");

export const getAuxiliaryModelForRetrieval = async (env: IEnv, user?: IUser) =>
  resolveSystemModel(env, user, "retrieval");

export const getAuxiliaryGuardrailsModel = async (
  env: IEnv,
  user?: IUser,
): Promise<ResolvedSystemModel> => {
  const selected = await resolveModalitySystemModel(env, user, "guardrails", {
    shouldUseCache: false,
  });

  if (!selected) {
    throw new AssistantError(
      "No active guardrails model is available for this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return selected;
};

export const getAuxiliaryDecisionModel = async (
  env: IEnv,
  user?: IUser,
  inputs: readonly ModelModality[] = [],
): Promise<ResolvedSystemModel | null> => {
  return resolveModalitySystemModel(env, user, "decision", {}, inputs);
};

export const resolveRerankingModel = async (
  env: IEnv,
  user?: IUser,
  selection: RerankingModelSelection = {},
): Promise<ResolvedSystemModel | null> => {
  const accessibleModels = await filterModelsForUserAccess(
    getModelsByOutputModality("reranking"),
    env,
    user?.id,
  );
  const executableModels = getExecutableModelsForAccount(accessibleModels, user);

  return selectRerankingModel(executableModels, env, selection);
};

export const getAuxiliaryRerankingModel = resolveRerankingModel;

export const getOcrModel = async (env: IEnv, user?: IUser): Promise<ResolvedSystemModel | null> =>
  resolveModalitySystemModel(env, user, "ocr");

export const getImageModel = async (env: IEnv, user?: IUser): Promise<ResolvedSystemModel | null> =>
  resolveModalitySystemModel(env, user, "image");

export const getVideoModel = async (env: IEnv, user?: IUser): Promise<ResolvedSystemModel | null> =>
  resolveModalitySystemModel(env, user, "video");

export const getMusicModel = async (env: IEnv, user?: IUser): Promise<ResolvedSystemModel | null> =>
  resolveModalitySystemModel(env, user, "music");

export interface ResolvedSpeechModel {
  id: string;
  name: string;
  model: string;
  provider: SpeechProvider;
  arenaScore: number | null;
}

export async function rankSpeechModels(env: IEnv, user?: IUser): Promise<ResolvedSpeechModel[]> {
  const accessible = await filterModelsForUserAccess(
    getModelsByOutputModality("speech"),
    env,
    user?.id,
    { shouldUseCache: false },
  );
  const voices = Object.fromEntries(
    Object.entries(accessible).filter(
      ([, model]) =>
        isModelRuntimeAvailable(model, env) &&
        modelHasInputModalities(model, ["text"]) &&
        speechProviderSchema.safeParse(model.provider).success,
    ),
  );

  return rankPolicyModelsByMediaScore(
    voices,
    TEXT_TO_SPEECH_ARENA_SCORE,
    getSystemModelLineup("speech").candidates,
    user,
  ).flatMap(({ id, config }) => {
    const provider = speechProviderSchema.safeParse(config.provider);

    return provider.success
      ? [
          {
            id,
            name: getModelDisplayName(config),
            model: config.matchingModel,
            provider: provider.data,
            arenaScore: readMediaScore(config, TEXT_TO_SPEECH_ARENA_SCORE) ?? null,
          },
        ]
      : [];
  });
}

export interface SpeechModelPreference {
  provider?: SpeechProvider | null;
  model?: string | null;
  required?: boolean;
}

export async function getSpeechModel(
  env: IEnv,
  user: IUser | undefined,
  preference: SpeechModelPreference = {},
): Promise<ResolvedSpeechModel> {
  const ranked = await rankSpeechModels(env, user);
  const preferred =
    ranked.find(
      (entry) =>
        preference.model && (entry.id === preference.model || entry.model === preference.model),
    ) ?? ranked.find((entry) => preference.provider && entry.provider === preference.provider);

  if (preference.required && (preference.model || preference.provider) && !preferred) {
    throw new AssistantError(
      `${preference.model ?? preference.provider} is not available for this account`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const selected = preferred ?? ranked[0];

  if (!selected) {
    throw new AssistantError(
      "No voice is available for this account. Add a speech provider key in settings.",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return selected;
}

export const getFimModel = async (env: IEnv, user?: IUser): Promise<ResolvedSystemModel | null> =>
  resolveCapabilitySystemModel(env, user, "fim");

export const getNextEditModel = async (
  env: IEnv,
  user?: IUser,
): Promise<ResolvedSystemModel | null> => resolveCapabilitySystemModel(env, user, "nextEdit");

export const getApplyEditModel = async (
  env: IEnv,
  user?: IUser,
): Promise<ResolvedSystemModel | null> => resolveCapabilitySystemModel(env, user, "applyEdit");

export const getAuxiliarySearchProvider = async (
  env: IEnv,
  user?: IUser,
  requestedProvider?: SearchProviderName,
): Promise<SearchProviderName> => {
  if (requestedProvider === "duckduckgo") {
    return "duckduckgo";
  }

  if (requestedProvider) {
    if (hasProEntitlement(user)) {
      return requestedProvider;
    }

    if (
      user?.id &&
      requestedProvider !== "cloudflare" &&
      requestedProvider !== "cloudflare-ai-search"
    ) {
      const providerKeyId =
        requestedProvider === "perplexity" ? "perplexity-ai" : requestedProvider;
      const hasProviderKey = await new UserSettingsRepository(env).hasProviderApiKey(
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
    const userSettings = await withCache(env, "user-settings", [user.id.toString()], () =>
      new UserSettingsRepository(env).getUserSettings(user.id),
    );

    const preferred = searchProviderSchema.safeParse(userSettings?.search_provider);

    if (preferred.success) {
      try {
        return await getAuxiliarySearchProvider(env, user, preferred.data);
      } catch (error) {
        if (error instanceof AssistantError && error.type === ErrorType.AUTHORISATION_ERROR) {
          return "duckduckgo";
        }

        throw error;
      }
    }
  }

  return hasProEntitlement(user) ? "tavily" : "duckduckgo";
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

  const providerSettings = await withCache(
    env,
    "user-provider-settings",
    [user.id.toString()],
    () => new UserSettingsRepository(env).getUserProviderSettings(user.id),
  );

  const hasProvider = Array.isArray(providerSettings)
    ? providerSettings.some((setting: any) => {
        const isEnabled = Boolean(setting?.enabled);
        const hasApiKey = Boolean(setting?.hasApiKey);
        const isProviderMatch = setting?.provider_id === providerToUse;

        return isProviderMatch && isEnabled && (hasProEntitlement(user) || hasApiKey);
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
  user?: IUser,
): Promise<{
  model: string;
  provider: string;
  transcriptionProvider: string;
}> => {
  const transcriptionProvider = userSettings?.transcription_provider || "workers";
  const transcriptionModel = userSettings?.transcription_model || "whisper";
  const configured = await findModelConfig(transcriptionModel, env, undefined, user?.id);

  if (configured && isModelRuntimeAvailable(configured, env)) {
    return {
      model: configured.matchingModel,
      provider: configured.provider,
      transcriptionProvider,
    };
  }

  const fallback = await resolveModalitySystemModel(env, user, "transcription");

  if (fallback) {
    return {
      model: fallback.model,
      provider: fallback.provider,
      transcriptionProvider,
    };
  }

  if (configured) {
    return {
      model: configured.matchingModel,
      provider: configured.provider,
      transcriptionProvider,
    };
  }

  throw new AssistantError(
    "No active transcription model is available for this account",
    ErrorType.CONFIGURATION_ERROR,
  );
};
