import {
	availableModalities,
	filterModelsForUserAccess,
	getAvailableStrengths,
	getModelConfig,
	getModels,
	getModelsByCapability,
	getModelsByModality,
} from "~/lib/providers/models";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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
	return await filterModelsForUserAccess(allModels, env, userId, {
		shouldUseCache: false,
	});
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
export async function listModelsByStrength(
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
 * Get all model modalities.
 */
export function listModalities() {
	return availableModalities;
}

/**
 * Filter models by modality and user access.
 */
export async function listModelsByModality(
	env: IEnv,
	modality: string,
	userId?: number,
) {
	const models = getModelsByModality(
		modality as (typeof availableModalities)[number],
	);
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
