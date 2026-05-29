import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { extractGeneratedAsset } from "~/lib/providers/utils/helpers";
import { AssistantError, ErrorType } from "~/utils/errors";
import { omitNullishValues } from "~/utils/objects";
import type { SpeechGenerationRequest, SpeechGenerationResult, SpeechProvider } from "../index";

const DEFAULT_MODEL = "replicate-chatterbox-turbo";

export class ReplicateSpeechProvider implements SpeechProvider {
	name = "replicate";
	models = [DEFAULT_MODEL];

	async generate(request: SpeechGenerationRequest): Promise<SpeechGenerationResult> {
		const modelId = request.model || DEFAULT_MODEL;
		const modelConfig = await getModelConfigByModel(modelId);

		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${modelId}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const replicatePayload = omitNullishValues({
			text: request.prompt,
			prompt: request.prompt,
			voice: request.voice,
			language: request.locale,
			...request.metadata,
		});

		validateReplicatePayload({
			payload: replicatePayload,
			schema: modelConfig.inputSchema,
			modelName: modelConfig.name || modelId,
		});

		const provider = getChatProvider(modelConfig.provider || "replicate", {
			env: request.env,
			user: request.user,
		});

		const response = await provider.getResponse({
			completion_id: request.completion_id,
			app_url: request.app_url,
			model: modelConfig.matchingModel,
			messages: [
				{
					role: "user",
					content: request.prompt,
				},
			],
			body: {
				input: replicatePayload,
			},
			env: request.env,
			user: request.user,
		});

		const attachment = extractGeneratedAsset(response);

		return {
			url: attachment.url,
			key: attachment.key,
			metadata: attachment,
			raw: response,
		};
	}
}
