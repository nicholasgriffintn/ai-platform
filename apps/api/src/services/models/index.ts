import {
  availableCapabilities,
  availableModelTypes,
  filterModelsForUserAccess,
  getModelConfig,
  getModels,
  getModelsByCapability,
  getModelsByType,
} from "~/lib/models";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

/**
 * List all models available to the user.
 */
export async function listModels(env: IEnv, userId?: number) {
  const allModels = getModels({
    shouldUseCache: false,
    excludeTypes: [
      "guardrails",
      "voice-activity-detection",
      "reranking",
      "embedding",
      "speech",
    ],
  });
  return await filterModelsForUserAccess(allModels, env, userId, {
    shouldUseCache: false,
  });
}

/**
 * Get all capabilities.
 */
export function listCapabilities() {
  return availableCapabilities;
}

/**
 * Filter models by capability and user access.
 */
export async function listModelsByCapability(
  env: IEnv,
  capability: string,
  userId?: number,
) {
  const models = getModelsByCapability(capability);
  return await filterModelsForUserAccess(models, env, userId, {
    shouldUseCache: false,
  });
}

/**
 * Get all model types.
 */
export function listModelTypes() {
  return availableModelTypes;
}

/**
 * Filter models by type and user access.
 */
export async function listModelsByType(
  env: IEnv,
  type: string,
  userId?: number,
) {
  const models = getModelsByType(type);
  return await filterModelsForUserAccess(models, env, userId, {
    shouldUseCache: false,
  });
}

/**
 * Get model details by ID if user has access.
 */
export async function getModelDetails(env: IEnv, id: string, userId?: number) {
  const model = await getModelConfig(id);
  const accessibleModels = await filterModelsForUserAccess(
    { [id]: model },
    env,
    userId,
    {
      shouldUseCache: false,
    },
  );
  if (!accessibleModels[id]) {
    throw new AssistantError(
      "Model not found or user does not have access",
      ErrorType.NOT_FOUND,
    );
  }
  return model;
}
