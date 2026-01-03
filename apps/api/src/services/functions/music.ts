import {
	type MusicGenerationParams,
	type MusicResponse,
	generateMusic,
} from "~/services/generate/music";
import { replicateModelConfig } from "~/data-model/models/replicate";
import type { IFunction, IRequest, ModelConfig } from "~/types";

const DEFAULT_DURATION = 8;
const MUSIC_PROVIDERS = ["replicate", "elevenlabs"] as const;

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

const MUSIC_MODELS = [
	...getModelIdsByOutput(replicateModelConfig, "replicate", "audio"),
].sort();

export const create_music: IFunction = {
	name: "create_music",
	description:
		"Composes musical pieces based on stylistic and emotional prompts. Use when users request songs, melodies, or audio compositions.",
	parameters: {
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description:
					"Description of the desired music including style, mood, tempo, and instruments",
			},
			input_audio: {
				type: "string",
				description: "An audio file that will influence the generated music.",
			},
			duration: {
				type: "number",
				description: `The duration of the generated music in seconds. Defaults to ${DEFAULT_DURATION} seconds.`,
				default: DEFAULT_DURATION,
			},
			provider: {
				type: "string",
				description: "Music generation provider",
				enum: Array.from(MUSIC_PROVIDERS),
				default: "replicate",
			},
			model: {
				type: "string",
				description: "Specific music generation model to use",
				enum: MUSIC_MODELS,
			},
		},
		required: ["prompt"],
	},
	type: "premium",
	costPerCall: 1,
	function: async (
		completion_id: string,
		args: MusicGenerationParams,
		req: IRequest,
		app_url?: string,
	): Promise<MusicResponse> => {
		const response = await generateMusic({
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
