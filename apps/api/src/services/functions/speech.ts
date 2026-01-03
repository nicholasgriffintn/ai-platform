import {
	type SpeechGenerationParams,
	type SpeechResponse,
	generateSpeech,
} from "~/services/generate/speech";
import { replicateModelConfig } from "~/data-model/models/replicate";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import type { IFunction, IRequest, ModelConfig } from "~/types";

const SPEECH_PROVIDERS = ["workers-ai", "replicate"] as const;

function getModelIdsByOutput(
	config: ModelConfig,
	provider: string,
	modality: "image" | "audio" | "video" | "speech",
) {
	return Object.entries(config)
		.filter(
			([, model]) =>
				model.provider === provider &&
				(model.modalities?.output ?? []).includes(modality),
		)
		.map(([id]) => id);
}

const SPEECH_MODELS = [
	...getModelIdsByOutput(workersAiModelConfig, "workers-ai", "speech"),
	...getModelIdsByOutput(replicateModelConfig, "replicate", "audio"),
].sort();

export const create_speech: IFunction = {
	name: "create_speech",
	description:
		"Converts text to spoken audio with customizable voice characteristics. Use when users need audio narration, pronunciation guidance, or accessibility options.",
	parameters: {
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description: "the exact prompt passed in",
			},
			lang: {
				type: "string",
				description:
					"The language code for the speech (e.g., 'en-US', 'fr-FR', 'ja-JP')",
				default: "en-US",
			},
			provider: {
				type: "string",
				description: "Speech generation provider",
				enum: Array.from(SPEECH_PROVIDERS),
				default: "workers-ai",
			},
			model: {
				type: "string",
				description: "Specific speech generation model to use",
				enum: SPEECH_MODELS,
			},
			voice: {
				type: "string",
				description: "Voice preset or identifier for speech synthesis",
			},
		},
		required: ["prompt"],
	},
	type: "premium",
	costPerCall: 1,
	function: async (
		completion_id: string,
		args: SpeechGenerationParams,
		req: IRequest,
		app_url?: string,
	): Promise<SpeechResponse> => {
		const response = await generateSpeech({
			completion_id,
			app_url,
			env: req.env,
			context: req.context,
			args,
			user: req.user,
		});

		return response;
	},
};
