import {
  findModelConfigByMatchingModel,
  getFreeModels,
  getLineupFreeModels,
  getLineupModels,
  getModelConfigById,
  getModels,
  getModelsByOutputModality,
  getExecutableModelsForAccount,
  isSystemRoleModel,
  listSystemModelLayers,
  rankPolicyModelsByMediaScore,
  readMediaScore,
  resolveDefaultChatModel,
  resolveSystemRoleModels,
  resolveTierModel,
  TEXT_TO_SPEECH_ARENA_SCORE,
} from "@ngriffin_uk/polychat-ai-models";
import {
  isProviderPlatformEnabled,
  selectRerankingModel,
  isModelRuntimeAvailable,
  toTranscriptionProvider,
  type RerankingModelSelection,
} from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  NEWS_SEARCH_PROVIDERS,
  searchProviderSchema,
  getModelDisplayName,
  getSystemModelLineup,
  speechProviderSchema,
  modelHasInputModalities,
  resolveLineupCandidates,
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
import type { IEnv, IUser, ResearchProviderName, SearchProviderName } from "~/types";

import { loadSystemModelLayers, type SystemModelScope } from "./scope";
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
  id: string;
  name: string;
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

export interface SystemModelOptions extends ModelAccessOptions {
  inputs?: readonly ModelModality[];
}

function listRoleSourceModels(role: SystemModelRole, user: IUser | undefined) {
  const requirement = getSystemModelLineup(role).requires;

  if (requirement.kind === "text") {
    return user?.id ? getLineupModels() : getLineupFreeModels();
  }

  if (requirement.kind === "output") {
    return getModelsByOutputModality(requirement.output);
  }

  return getModels();
}

export async function listSystemRoleModels(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
  options: SystemModelOptions = {},
): Promise<Record<string, ModelConfigItem>> {
  const accessible = await filterModelsForUserAccess(
    listRoleSourceModels(role, user),
    env,
    user?.id,
    { shouldUseCache: true, ...options },
  );

  return Object.fromEntries(
    Object.entries(getExecutableModelsForAccount(accessible, user)).filter(
      ([, model]) =>
        isModelRuntimeAvailable(model, env) &&
        isSystemRoleModel(role, model) &&
        modelHasInputModalities(model, options.inputs ?? []),
    ),
  );
}

export type { SystemModelScope };

export async function listSystemModels(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
  scope: SystemModelScope = {},
  options: SystemModelOptions = {},
): Promise<ResolvedSystemModel[]> {
  const [models, layers] = await Promise.all([
    listSystemRoleModels(env, user, role, options),
    loadSystemModelLayers(env, user, scope),
  ]);

  return resolveSystemRoleModels(models, role, layers, user).map((selected) => ({
    id: selected.id,
    name: getModelDisplayName(selected.config),
    model: selected.config.matchingModel,
    provider: selected.config.provider,
    effort: selected.effort,
  }));
}

export async function getSystemModel(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
  scope: SystemModelScope = {},
  options: SystemModelOptions = {},
): Promise<ResolvedSystemModel | null> {
  return (await listSystemModels(env, user, role, scope, options))[0] ?? null;
}

export async function runWithSystemModel<T>(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
  run: (model: ResolvedSystemModel) => Promise<T>,
  scope: SystemModelScope = {},
  options: SystemModelOptions = {},
): Promise<T> {
  const candidates = await listSystemModels(env, user, role, scope, options);
  let lastError: unknown = new AssistantError(
    `No ${getSystemModelLineup(role).label.toLowerCase()} model is available. Choose one in your model choices.`,
    ErrorType.CONFIGURATION_ERROR,
  );

  for (const candidate of candidates) {
    try {
      return await run(candidate);
    } catch (error) {
      logger.warn("System model failed, trying the next choice", {
        role,
        model: candidate.id,
        error,
      });
      lastError = error;
    }
  }

  throw lastError;
}

export async function requireSystemModel(
  env: IEnv,
  user: IUser | undefined,
  role: SystemModelRole,
  scope: SystemModelScope = {},
  options: SystemModelOptions = {},
): Promise<ResolvedSystemModel> {
  const selected = await getSystemModel(env, user, role, scope, options);

  if (!selected) {
    throw new AssistantError(
      `No ${getSystemModelLineup(role).label.toLowerCase()} model is available. Choose one in your model choices.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return selected;
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
    name: getModelDisplayName(selected.config),
    model: selected.config.matchingModel,
    provider: selected.config.provider,
    effort: selected.effort,
  };
}

export const getAuxiliaryModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  requireSystemModel(env, user, "housekeeping", scope);

export const getTitlingModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  requireSystemModel(env, user, "titling", scope);

export const getCompactionModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  requireSystemModel(env, user, "compaction", scope);

export const getAuxiliaryModelForRetrieval = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  requireSystemModel(env, user, "retrieval", scope);

export const getAuxiliaryGuardrailsModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  requireSystemModel(env, user, "guardrails", scope, { shouldUseCache: false });

export const getAuxiliaryDecisionModel = (
  env: IEnv,
  user?: IUser,
  inputs: readonly ModelModality[] = [],
  scope?: SystemModelScope,
): Promise<ResolvedSystemModel | null> => getSystemModel(env, user, "decision", scope, { inputs });

export const resolveRerankingModel = async (
  env: IEnv,
  user?: IUser,
  selection: RerankingModelSelection = {},
  scope?: SystemModelScope,
): Promise<Pick<ResolvedSystemModel, "model" | "provider"> | null> => {
  if (!selection.model && !selection.provider) {
    return getSystemModel(env, user, "reranking", scope);
  }

  return selectRerankingModel(await listSystemRoleModels(env, user, "reranking"), env, selection);
};

export const getAuxiliaryRerankingModel = resolveRerankingModel;

export const getOcrModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "ocr", scope);

export const getImageModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "image", scope);

export const getVideoModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "video", scope);

export const getMusicModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "music", scope);

export const getFimModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "fim", scope);

export const getNextEditModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "nextEdit", scope);

export const getApplyEditModel = (env: IEnv, user?: IUser, scope?: SystemModelScope) =>
  getSystemModel(env, user, "applyEdit", scope);

export interface ResolvedSpeechModel {
  id: string;
  name: string;
  model: string;
  provider: SpeechProvider;
  arenaScore: number | null;
}

function toResolvedSpeechModel(id: string, config: ModelConfigItem): ResolvedSpeechModel[] {
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
}

export async function rankSpeechModels(
  env: IEnv,
  user?: IUser,
  scope?: SystemModelScope,
): Promise<ResolvedSpeechModel[]> {
  const [voices, layers] = await Promise.all([
    listSystemRoleModels(env, user, "speech", { shouldUseCache: false }),
    loadSystemModelLayers(env, user, scope),
  ]);
  const chosen = listSystemModelLayers("speech", layers).flatMap((layer) =>
    resolveLineupCandidates(getExecutableModelsForAccount(voices, user), layer.candidates),
  );
  const ranked = rankPolicyModelsByMediaScore(
    voices,
    TEXT_TO_SPEECH_ARENA_SCORE,
    getSystemModelLineup("speech").defaults,
    user,
  );
  const seen = new Set<string>();

  return [...chosen, ...ranked].flatMap(({ id, config }) => {
    if (seen.has(id)) {
      return [];
    }

    seen.add(id);

    return toResolvedSpeechModel(id, config);
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
  scope?: SystemModelScope,
): Promise<ResolvedSpeechModel> {
  const ranked = await rankSpeechModels(env, user, scope);
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
      "No voice is available for this account. Choose one in your model choices.",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return selected;
}

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

export const getNewsSearchProvider = async (
  env: IEnv,
  user?: IUser,
): Promise<SearchProviderName> => {
  const preferred = await getAuxiliarySearchProvider(env, user);

  if (NEWS_SEARCH_PROVIDERS.includes(preferred)) {
    return preferred;
  }

  for (const provider of NEWS_SEARCH_PROVIDERS) {
    try {
      return await getAuxiliarySearchProvider(env, user, provider);
    } catch (error) {
      if (!(error instanceof AssistantError && error.type === ErrorType.AUTHORISATION_ERROR)) {
        throw error;
      }
    }
  }

  throw new AssistantError(
    `News search needs ${NEWS_SEARCH_PROVIDERS.join(" or ")}; ${preferred} cannot search by publish date`,
    ErrorType.CONFIGURATION_ERROR,
    400,
  );
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

export async function getTranscriptionModel(
  env: IEnv,
  user?: IUser,
  scope?: SystemModelScope,
): Promise<{ model: string; provider: string; transcriptionProvider: string }> {
  const selected = await requireSystemModel(env, user, "transcription", scope);

  return {
    model: selected.model,
    provider: selected.provider,
    transcriptionProvider: toTranscriptionProvider(selected.provider),
  };
}
