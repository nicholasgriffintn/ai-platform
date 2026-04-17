import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getModelConfigByModel } from "~/lib/providers/models";
import { extractGeneratedAsset } from "~/lib/providers/utils/helpers";
import { AssistantError, ErrorType } from "~/utils/errors";
import { buildInputSchemaInput } from "~/utils/inputSchema";
import type {
	MusicGenerationRequest,
	MusicGenerationResult,
	MusicProvider,
} from "../index";

const DEFAULT_MODEL = "workers-ai-minimax-music-2-6";

export class WorkersAiMusicProvider implements MusicProvider {
	name = "workers-ai";
	models = [DEFAULT_MODEL];

	async generate(
		request: MusicGenerationRequest,
	): Promise<MusicGenerationResult> {
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
						prompt: request.prompt,
						duration: request.duration,
						input_audio: request.inputAudio,
						...request.metadata,
					},
				},
			},
			modelConfig,
		).input;

		const response = await provider.getResponse({
			completion_id: request.completion_id,
			app_url: request.app_url,
			model: modelConfig.matchingModel,
			messages: [{ role: "user", content: request.prompt }],
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
