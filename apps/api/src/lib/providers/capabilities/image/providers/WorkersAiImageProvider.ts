import { getModelConfigByModel } from "~/lib/providers/models";
import { getTextToImageSystemPrompt, imagePrompts } from "~/lib/prompts/image";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { extractGeneratedAsset } from "~/lib/providers/utils/helpers";
import { buildInputSchemaInput } from "~/utils/inputSchema";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	ImageGenerationRequest,
	ImageGenerationResult,
	ImageProvider,
} from "../index";

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-2-dev";

function resolveStylePrompt(style?: string): string {
	const styleKey =
		style && Object.prototype.hasOwnProperty.call(imagePrompts, style)
			? (style as keyof typeof imagePrompts)
			: "default";
	return getTextToImageSystemPrompt(styleKey);
}

export class WorkersAiImageProvider implements ImageProvider {
	name = "workers-ai";
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

		const provider = getChatProvider("workers-ai", {
			env: request.env,
			user: request.user,
		});

		const stylePrompt = resolveStylePrompt(request.style);
		const prompt = stylePrompt
			? `${stylePrompt}\n\n${request.prompt}`
			: request.prompt;
		const input = buildInputSchemaInput(
			{
				messages: [{ role: "user", content: prompt }],
				body: {
					input: {
						prompt,
						style: request.style,
						aspect_ratio: request.aspectRatio,
						width: request.width,
						height: request.height,
						steps: request.steps,
						num_steps: request.steps,
						...request.metadata,
					},
				},
			},
			modelConfig,
		).input;

		const response = await provider.getResponse({
			completion_id: request.completion_id,
			model: modelConfig.matchingModel,
			app_url: request.app_url,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: prompt,
						},
					],
				},
			],
			body: {
				input,
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
