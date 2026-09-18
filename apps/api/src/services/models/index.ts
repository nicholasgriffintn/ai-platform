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
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { RepositoryManager } from "~/repositories";
import { filterModelsForUserAccess, getModelConfig } from "~/services/models/resolve";
import type { IEnv, IUser } from "~/types";

import { resolveModelReadiness } from "./readiness";

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
  });
  const executableModelIds = new Set(
    Object.keys(getExecutableModelsForAccount(filteredModels, user)),
  );
  const defaultModel = tryResolveDefaultChatModel(filteredModels, user)?.id;

  return Object.fromEntries(
    Object.entries(includeModelIds(filteredModels)).map(([id, model]) => {
      const enrichedModel = {
        ...model,
        isDefault: id === defaultModel,
        isExecutable: executableModelIds.has(id),
      };

      return [
        id,
        {
          ...enrichedModel,
          readiness: resolveModelReadiness(enrichedModel, user),
        },
      ];
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
    includeTrainingDeployments: false,
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
    includeTrainingDeployments: modality === "text",
  });

  return includeModelIds(filteredModels);
}

export async function listModelsByOutputModality(env: IEnv, modality: string, userId?: number) {
  const models = getModelsByOutputModality(modality as (typeof availableModalities)[number]);
  const filteredModels = await filterModelsForUserAccess(models, env, userId, {
    shouldUseCache: false,
    includeTrainingDeployments: modality === "text",
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

export async function listArtificialAnalysisModels(
  env: IEnv,
  options: { page: number; limit: number },
) {
  const result = await RepositoryManager.getInstance(env).artificialAnalysis.listPage(options);

  return {
    attribution: {
      label: "Artificial Analysis",
      url: "https://artificialanalysis.ai/",
    },
    models: result.models,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  };
}
