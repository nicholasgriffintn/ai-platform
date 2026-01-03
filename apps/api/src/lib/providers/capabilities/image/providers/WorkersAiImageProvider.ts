import { getTextToImageSystemPrompt, imagePrompts } from "~/lib/prompts/image";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
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

export class WorkersAiImageProvider implements ImageProvider {
	name = "workers-ai";
	models = [DEFAULT_MODEL];

	async generate(
		request: ImageGenerationRequest,
	): Promise<ImageGenerationResult> {
		const provider = getChatProvider("workers-ai", {
			env: request.env,
			user: request.user,
		});

		const stylePrompt = resolveStylePrompt(request.style);
		const prompt = stylePrompt
			? `${stylePrompt}\n\n${request.prompt}`
			: request.prompt;

		const response = await provider.getResponse({
			completion_id: request.completion_id,
			model: request.model || DEFAULT_MODEL,
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
