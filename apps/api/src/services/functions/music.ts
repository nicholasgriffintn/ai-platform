import type { IFunction, IRequest } from "../../types";
import {
	type MusicGenerationParams,
	type MusicResponse,
	generateMusic,
} from "../apps/generate/music";

const DEFAULT_DURATION = 8;

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
		},
		required: ["prompt"],
	},
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
			args,
		});

		return response;
	},
};
