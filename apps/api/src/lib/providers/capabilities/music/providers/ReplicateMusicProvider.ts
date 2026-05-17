import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { extractGeneratedAsset } from "~/lib/providers/utils/helpers";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { MusicGenerationRequest, MusicGenerationResult, MusicProvider } from "../index";

const DEFAULT_MODEL = "replicate-stable-audio";

export class ReplicateMusicProvider implements MusicProvider {
	name = "replicate";
	models = [DEFAULT_MODEL];

	protected getDefaultModel(): string {
		return DEFAULT_MODEL;
	}

	async generate(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
		const modelId = request.model || this.getDefaultModel();
		const modelConfig = await getModelConfigByModel(modelId);

		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${modelId}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const replicatePayload = Object.fromEntries(
			Object.entries({
				prompt: request.prompt,
				input_audio: request.inputAudio,
				duration: request.duration,
				...request.metadata,
			}).filter(([, value]) => value !== undefined && value !== null),
		);

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
