import { getTextToImageSystemPrompt, imagePrompts } from "~/lib/prompts/image";
import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	ImageGenerationRequest,
	ImageGenerationResult,
	ImageProvider,
} from "../index";

const DEFAULT_MODEL = "replicate-flux-2-pro";

function resolveStylePrompt(style?: string): string {
	const styleKey =
		style && Object.prototype.hasOwnProperty.call(imagePrompts, style)
			? (style as keyof typeof imagePrompts)
			: "default";
	return getTextToImageSystemPrompt(styleKey);
}

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

export class ReplicateImageProvider implements ImageProvider {
	name = "replicate";
	models = [DEFAULT_MODEL];

	async generate(
		request: ImageGenerationRequest,
	): Promise<ImageGenerationResult> {
		const modelId = request.model || DEFAULT_MODEL;
		const modelConfig = await getModelConfigByModel(modelId);

		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${modelId}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const stylePrompt = resolveStylePrompt(request.style);
		const prompt = stylePrompt
			? `${stylePrompt}\n\n${request.prompt}`
			: request.prompt;

		const replicatePayload = Object.fromEntries(
			Object.entries({
				prompt,
				aspect_ratio: request.aspectRatio,
				width: request.width,
				height: request.height,
				steps: request.steps,
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
					content: prompt,
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
