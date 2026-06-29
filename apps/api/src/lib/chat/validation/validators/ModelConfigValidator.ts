import { selectModels } from "~/lib/chat/modelSelection";
import { getAllAttachments } from "~/lib/chat/utils";
import type {
	ValidationContext,
	Validator,
	ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import { findModelConfig } from "~/lib/providers/models";
import type { CoreChatOptions } from "~/types";
import { getLogger } from "~/utils/logger";
import { resolveRequestUser } from "~/utils/requestUser";

const logger = getLogger({
	prefix: "lib/chat/validation/validators/ModelConfigValidator",
});

export class ModelConfigValidator implements Validator {
	async validate(options: CoreChatOptions, context: ValidationContext): Promise<ValidatorResult> {
		const {
			env,
			model: requestedModel,
			models: requestedModels,
			provider: requestedProvider,
			model_router_mode,
			completion_id,
			use_multi_model = false,
			budget_constraint,
		} = options;
		const user = resolveRequestUser(options);

		if (!context.sanitizedMessages || !context.lastMessage) {
			return {
				validation: {
					isValid: false,
					error: "Missing sanitized messages context",
					validationType: "model",
				},
				context: {},
			};
		}

		const lastMessageContent = Array.isArray(context.lastMessage.content)
			? context.lastMessage.content
			: [
					{
						type: "text" as const,
						text: context.lastMessage.content as string,
					},
				];

		const lastMessageContentText = lastMessageContent.find((c) => c.type === "text")?.text || "";

		const { allAttachments } = getAllAttachments(lastMessageContent);

		try {
			const selectedModels = await selectModels(
				env,
				lastMessageContentText,
				allAttachments,
				budget_constraint,
				user,
				completion_id,
				requestedModel,
				use_multi_model,
				requestedModels,
				requestedProvider,
				model_router_mode,
			);

			logger.info("Selected models", { selectedModels });

			if (!selectedModels || selectedModels.length === 0) {
				return {
					validation: {
						isValid: false,
						error: "No models selected",
						validationType: "model",
					},
					context: {},
				};
			}

			const primaryModelName = selectedModels[0];
			const primaryModelConfig = await findModelConfig(
				primaryModelName,
				env,
				requestedProvider,
				user?.id,
			);

			if (!primaryModelConfig) {
				return {
					validation: {
						isValid: false,
						error: "Invalid model configuration",
						validationType: "model",
					},
					context: {},
				};
			}

			return {
				validation: { isValid: true },
				context: {
					modelConfig: primaryModelConfig,
					selectedModels: selectedModels,
				},
			};
		} catch (error: any) {
			return {
				validation: {
					isValid: false,
					error: `Model validation failed: ${error.message}`,
					validationType: "model",
				},
				context: {},
			};
		}
	}
}
