import {
  availableModalities,
  getAvailableStrengths,
  getModels,
  getModelsByCapability,
  getModelsByModality,
  getModelsByOutputModality,
  getExecutableModelsForAccount,
  tryResolveDefaultChatModel,
} from "@ngriffin_uk/polychat-ai-models";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelBenchmarkStanding, ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createRepositories } from "~/infrastructure/database/repositories";
import { listModelBenchmarkStandings } from "~/modules/benchmarks/application/boards";
import { filterModelsForUserAccess, getModelConfig } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

import { resolveModelReadiness } from "./readiness";

const logger = getLogger({ prefix: "modules/models/application" });

async function loadBenchmarkStandings(
  env: IEnv,
  userId?: number,
): Promise<Map<string, ModelBenchmarkStanding[]>> {
  try {
    return await listModelBenchmarkStandings(createRepositories(env), userId);
  } catch (error) {
    logger.warn("Benchmark standings are unavailable for the model list", { error });

    return new Map();
  }
}

function includeModelIds(models: ModelConfig): ModelConfig {
  const modelsWithIds: ModelConfig = {};

  for (const [id, model] of Object.entries(models)) {
    modelsWithIds[id] = {
      ...model,
      id,
    };
  }

  return modelsWithIds;
}

const CATALOGUE_EXCLUDED_MODALITIES = [
  "guardrails",
  "voice-activity-detection",
  "reranking",
  "embedding",
  "speech",
] as const;

export function listModelCatalogue() {
  return includeModelIds(
    getModels({
      excludeModalities: [...CATALOGUE_EXCLUDED_MODALITIES],
      chatSurfaceOnly: true,
    }),
  );
}

export async function listModels(env: IEnv, user?: IUser): Promise<ModelConfig> {
  const allModels = getModels({
    excludeModalities: [...CATALOGUE_EXCLUDED_MODALITIES],
    chatSurfaceOnly: true,
  });
  const filteredModels = await filterModelsForUserAccess(allModels, env, user?.id, {
    shouldUseCache: false,
    includePlatformModels: true,
  });
  const executableModelIds = new Set(
    Object.keys(getExecutableModelsForAccount(filteredModels, user)),
  );
  const defaultModel = tryResolveDefaultChatModel(filteredModels, user)?.id;
  const benchmarks = await loadBenchmarkStandings(env, user?.id);

  return Object.fromEntries(
    Object.entries(includeModelIds(filteredModels)).map(([id, model]) => {
      const enrichedModel = {
        ...model,
        isDefault: id === defaultModel,
        isExecutable: executableModelIds.has(id),
        ...(benchmarks.has(id) ? { benchmarks: benchmarks.get(id) } : {}),
      };
      const readiness = resolveModelReadiness(enrichedModel, user);

      return [id, readiness.state === "ready" ? enrichedModel : { ...enrichedModel, readiness }];
    }),
  );
}

export function listStrengths() {
  return getAvailableStrengths();
}

export async function listModelsByStrength(env: IEnv, capability: string, userId?: number) {
  const models = getModelsByCapability(capability);
  const filteredModels = await filterModelsForUserAccess(models, env, userId, {
    shouldUseCache: false,
    includePlatformModels: false,
  });

  return includeModelIds(filteredModels);
}

export function listModalities() {
  return availableModalities;
}

export async function listModelsByModality(env: IEnv, modality: string, userId?: number) {
  const models = getModelsByModality(modality as (typeof availableModalities)[number]);
  const filteredModels = await filterModelsForUserAccess(models, env, userId, {
    shouldUseCache: false,
    includePlatformModels: modality === "text",
  });

  return includeModelIds(filteredModels);
}

export async function listModelsByOutputModality(env: IEnv, modality: string, userId?: number) {
  const models = getModelsByOutputModality(modality as (typeof availableModalities)[number]);
  const filteredModels = await filterModelsForUserAccess(models, env, userId, {
    shouldUseCache: false,
    includePlatformModels: modality === "text",
  });

  return includeModelIds(filteredModels);
}

export { resolveTierLineup } from "./tiers";

export async function getModelDetails(env: IEnv, id: string, userId?: number) {
  const model = await getModelConfig(id, env, undefined, userId);

  if (!model) {
    throw new AssistantError("Model not found or user does not have access", ErrorType.NOT_FOUND);
  }

  const accessibleModels = await filterModelsForUserAccess({ [id]: model }, env, userId, {
    shouldUseCache: false,
  });

  if (!accessibleModels[id]) {
    throw new AssistantError("Model not found or user does not have access", ErrorType.NOT_FOUND);
  }

  return {
    ...model,
    id,
  };
}
