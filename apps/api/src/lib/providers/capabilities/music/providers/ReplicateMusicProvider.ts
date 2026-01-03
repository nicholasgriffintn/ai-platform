import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	MusicGenerationRequest,
	MusicGenerationResult,
	MusicProvider,
} from "../index";

const DEFAULT_MODEL = "replicate-stable-audio";

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

export class ReplicateMusicProvider implements MusicProvider {
	name = "replicate";
	models = [DEFAULT_MODEL];

	protected getDefaultModel(): string {
		return DEFAULT_MODEL;
	}

	async generate(
		request: MusicGenerationRequest,
	): Promise<MusicGenerationResult> {
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
