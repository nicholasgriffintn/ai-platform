import { ModelRouter } from "~/lib/modelRouter";
import type { Attachment } from "~/types";

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
 * @returns The selected models
 */
export async function selectModels(
	env: any,
	lastMessageText: string,
	attachments: Attachment[],
	budgetConstraint: number | undefined,
	user: any,
	completionId: string,
	requestedModel?: string,
	use_multi_model?: boolean,
	requestedModels?: string[],
): Promise<string[]> {
	const explicitModels = requestedModels
		?.map((model) => model.trim())
		.filter((model) => model.length > 0);
	if (explicitModels?.length) {
		return [...new Set(explicitModels)];
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
