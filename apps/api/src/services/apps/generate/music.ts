import { AIProviderFactory } from "../../../providers/factory";
import type { IEnv } from "../../../types";

export interface MusicGenerationParams {
	prompt: string;
	input_audio?: string;
	duration?: number;
}

export interface MusicResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

const REPLICATE_MODEL_VERSION =
	"671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

export async function generateMusic({
	completion_id,
	appUrl,
	env,
	args,
}: {
	completion_id: string;
	appUrl: string | undefined;
	env: IEnv;
	args: MusicGenerationParams;
}): Promise<MusicResponse> {
	try {
		if (!args.prompt) {
			return {
				status: "error",
				name: "create_music",
				content: "Missing prompt",
				data: {},
			};
		}

		const provider = AIProviderFactory.getProvider("replicate");

		const musicData = await provider.getResponse({
			completion_id,
			appUrl,
			model: REPLICATE_MODEL_VERSION,
			messages: [
				{
					role: "user",
					// @ts-ignore
					content: {
						...args,
					},
				},
			],
			env: env,
		});

		return {
			status: "success",
			name: "create_music",
			content: "Music generated successfully",
			data: musicData,
		};
	} catch (error) {
		return {
			status: "error",
			name: "create_music",
			content:
				error instanceof Error ? error.message : "Failed to generate music",
			data: {},
		};
	}
}
