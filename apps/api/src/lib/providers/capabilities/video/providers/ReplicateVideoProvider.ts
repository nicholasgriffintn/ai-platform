import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	VideoGenerationRequest,
	VideoGenerationResult,
	VideoProvider,
} from "../index";

const DEFAULT_MODEL = "replicate-google-veo-3-1-fast";

function extractAttachment(response: any) {
	const attachments = response?.data?.attachments ?? response?.attachments;
	if (Array.isArray(attachments) && attachments.length > 0) {
		const [first] = attachments;
		return {
			url: first?.url,
			key: first?.key,
		};
	}

	if (typeof response?.url === "string") {
		return { url: response.url };
	}

	if (typeof response?.output === "string") {
		return { url: response.output };
	}

	if (Array.isArray(response?.output) && response.output.length > 0) {
		const [first] = response.output;
		if (typeof first === "string") {
			return { url: first };
		}
		if (first?.url) {
			return { url: first.url, key: first.key };
		}
	}

	return {};
}

export class ReplicateVideoProvider implements VideoProvider {
	name = "replicate";
	models = [DEFAULT_MODEL];

	async generate(
		request: VideoGenerationRequest,
	): Promise<VideoGenerationResult> {
		const modelId = request.model || DEFAULT_MODEL;
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
				negative_prompt: request.negativePrompt,
				aspect_ratio: request.aspectRatio,
				width: request.width,
				height: request.height,
				duration: request.duration ?? request.videoLength,
				guidance_scale: request.guidanceScale,
				...(request.metadata ?? {}),
			}).filter(([, value]) => value !== undefined && value !== null),
		);

		validateReplicatePayload({
			payload: replicatePayload,
			schema: modelConfig.replicateInputSchema,
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

		const attachment = extractAttachment(response);

		return {
			url: attachment.url,
			key: attachment.key,
			metadata: attachment,
			raw: response,
		};
	}
}
