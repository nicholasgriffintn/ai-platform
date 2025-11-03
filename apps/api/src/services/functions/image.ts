import { imagePrompts } from "~/lib/prompts/image";
import {
	type ImageGenerationParams,
	type ImageResponse,
	generateImage,
} from "~/services/apps/generate/image";
import type { IFunction, IRequest } from "~/types";

export const create_image: IFunction = {
	name: "create_image",
	description:
		"Generates visual imagery based on detailed text descriptions. Use when users request illustrations, artwork, diagrams, or visual representations.",
	parameters: {
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description: "the exact prompt passed in",
			},
			image_style: {
				type: "string",
				description: "The style of the image to generate",
				enum: Object.keys(imagePrompts),
			},
			steps: {
				type: "integer",
				description: "The number of diffusion steps to use",
				minimum: 1,
				maximum: 8,
			},
		},
		required: ["prompt"],
	},
	type: "premium",
	costPerCall: 1,
	function: async (
		completion_id: string,
		args: ImageGenerationParams,
		req: IRequest,
		app_url?: string,
	): Promise<ImageResponse> => {
		const response = await generateImage({
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
