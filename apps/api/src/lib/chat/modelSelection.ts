import { ModelRouter } from "~/lib/modelRouter";
import { filterModelsForUserAccess, findModelConfig, getModels } from "~/lib/providers/models";
import type { ModelConfigItem } from "@assistant/schemas";
import type { Attachment, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

function normaliseExplicitModels(requestedModels?: string[]): string[] {
	const explicitModels = requestedModels
		?.map((model) => model.trim())
		.filter((model) => model.length > 0);

	return explicitModels?.length ? [...new Set(explicitModels)] : [];
}

function hasAccessibleModelConfig(
	accessibleModels: Record<string, ModelConfigItem>,
	requestedModel: string,
	requestedConfig: ModelConfigItem,
): boolean {
	return Object.entries(accessibleModels).some(([modelId, config]) => {
		if (modelId === requestedModel) {
			return true;
		}

		return (
			config.provider === requestedConfig.provider &&
			config.matchingModel === requestedConfig.matchingModel
		);
	});
}

async function assertExplicitModelsAccessible(
	env: IEnv,
	user: IUser | undefined,
	explicitModels: string[],
	requestedProvider?: string,
): Promise<void> {
	const allModels = getModels({ shouldUseCache: false });
	const accessibleModels = await filterModelsForUserAccess(allModels, env, user?.id, {
		shouldUseCache: false,
	});
	const inaccessibleModels: string[] = [];

	for (const requestedModel of explicitModels) {
		const requestedConfig = await findModelConfig(requestedModel, env, requestedProvider, user?.id);
		if (
			!requestedConfig ||
			!hasAccessibleModelConfig(accessibleModels, requestedModel, requestedConfig)
		) {
			inaccessibleModels.push(requestedModel);
		}
	}

	if (inaccessibleModels.length > 0) {
		throw new AssistantError(
			`Model not found or user does not have access: ${inaccessibleModels.join(", ")}`,
			ErrorType.AUTHENTICATION_ERROR,
			403,
		);
	}
}

/**
 * Chooses one or multiple models based on flags and user request.
 * @param env - The environment variables
 * @param lastMessageText - The last message text
 * @param attachments - The attachments
 * @param budgetConstraint - The budget constraint
 * @param user - The user
 * @param completionId - The completion ID
 * @param requestedModel - The requested model
 * @param use_multi_model - Whether to use multiple models
 * @param requestedModels - Explicit model IDs requested by the caller
 * @param requestedProvider - Optional provider constraint for requested models
 * @returns The selected models
 */
export async function selectModels(
	env: IEnv,
	lastMessageText: string,
	attachments: Attachment[],
	budgetConstraint: number | undefined,
	user: IUser | undefined,
	completionId: string,
	requestedModel?: string,
	use_multi_model?: boolean,
	requestedModels?: string[],
	requestedProvider?: string,
): Promise<string[]> {
	const explicitModels = normaliseExplicitModels(requestedModels);
	if (explicitModels.length) {
		await assertExplicitModelsAccessible(env, user, explicitModels, requestedProvider);
		return explicitModels;
	}

	if (use_multi_model && !requestedModel) {
		return ModelRouter.selectMultipleModels(
			env,
			lastMessageText,
			attachments,
			budgetConstraint,
			user,
			completionId,
		);
	}
	const model =
		requestedModel ||
		(await ModelRouter.selectModel(
			env,
			lastMessageText,
			attachments,
			budgetConstraint,
			user,
			completionId,
		));
	return [model];
}
