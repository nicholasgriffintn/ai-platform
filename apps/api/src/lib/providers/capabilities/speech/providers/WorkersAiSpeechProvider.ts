import { getChatProvider } from "~/lib/providers/capabilities/chat";
import type {
	SpeechGenerationRequest,
	SpeechGenerationResult,
	SpeechProvider,
} from "../index";

const DEFAULT_MODEL = "@cf/myshell-ai/melotts";

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

export class WorkersAiSpeechProvider implements SpeechProvider {
	name = "workers-ai";
	models = [DEFAULT_MODEL];

	async generate(
		request: SpeechGenerationRequest,
	): Promise<SpeechGenerationResult> {
		const provider = getChatProvider("workers-ai", {
			env: request.env,
			user: request.user,
		});

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
							text: request.prompt,
						},
					],
				},
			],
			lang: request.locale,
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
