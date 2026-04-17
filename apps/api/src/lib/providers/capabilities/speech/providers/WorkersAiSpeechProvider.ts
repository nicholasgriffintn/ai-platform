import { getModelConfigByModel } from "~/lib/providers/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { extractGeneratedAsset } from "~/lib/providers/utils/helpers";
import { buildInputSchemaInput } from "~/utils/inputSchema";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	SpeechGenerationRequest,
	SpeechGenerationResult,
	SpeechProvider,
} from "../index";

const DEFAULT_MODEL = "@cf/myshell-ai/melotts";

export class WorkersAiSpeechProvider implements SpeechProvider {
	name = "workers-ai";
	models = [DEFAULT_MODEL];

	async generate(
		request: SpeechGenerationRequest,
	): Promise<SpeechGenerationResult> {
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
		const input = buildInputSchemaInput(
			{
				messages: [{ role: "user", content: request.prompt }],
				body: {
					input: {
						text: request.prompt,
						prompt: request.prompt,
						voice: request.voice,
						voice_id: request.voice,
						language: request.locale,
						lang: request.locale,
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
							text: request.prompt,
						},
					],
				},
			],
			body: {
				input,
			},
			lang: request.locale,
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
