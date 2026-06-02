import {
	availableModalities,
	filterModelsForUserAccess,
	getAvailableStrengths,
	getModelConfig,
	getModels,
	getModelsByCapability,
	getModelsByModality,
	getModelsByOutputModality,
} from "~/lib/providers/models";
import type { IEnv, ModelConfig } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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

/**
 * List all models available to the user.
 */
export async function listModels(env: IEnv, userId?: number) {
	const allModels = getModels({
		shouldUseCache: false,
		excludeModalities: [
			"guardrails",
			"voice-activity-detection",
			"reranking",
			"embedding",
			"speech",
		],
	});
	const filteredModels = await filterModelsForUserAccess(allModels, env, userId, {
		shouldUseCache: false,
	});
	return includeModelIds(filteredModels);
}

/**
 * Get all capabilities.
 */
export function listStrengths() {
	return getAvailableStrengths();
}

/**
 * Filter models by capability and user access.
 */
export async function listModelsByStrength(env: IEnv, capability: string, userId?: number) {
	const models = getModelsByCapability(capability);
	const filteredModels = await filterModelsForUserAccess(models, env, userId, {
		shouldUseCache: false,
		includeTrainingDeployments: false,
	});
	return includeModelIds(filteredModels);
}

/**
 * Get all model modalities.
 */
export function listModalities() {
	return availableModalities;
}

/**
 * Filter models by modality and user access.
 */
export async function listModelsByModality(env: IEnv, modality: string, userId?: number) {
	const models = getModelsByModality(modality as (typeof availableModalities)[number]);
	const filteredModels = await filterModelsForUserAccess(models, env, userId, {
		shouldUseCache: false,
		includeTrainingDeployments: modality === "text",
	});
	return includeModelIds(filteredModels);
}

/**
 * Filter models by output modality and user access.
 */
export async function listModelsByOutputModality(env: IEnv, modality: string, userId?: number) {
	const models = getModelsByOutputModality(modality as (typeof availableModalities)[number]);
	const filteredModels = await filterModelsForUserAccess(models, env, userId, {
		shouldUseCache: false,
		includeTrainingDeployments: modality === "text",
	});
	return includeModelIds(filteredModels);
}

/**
 * Get model details by ID if user has access.
 */
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
