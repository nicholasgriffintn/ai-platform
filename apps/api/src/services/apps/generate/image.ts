import {
	getTextToImageSystemPrompt,
	type imagePrompts,
} from "../../../lib/prompts";
import { AIProviderFactory } from "../../../providers/factory";
import type { IEnv } from "../../../types";

export interface ImageGenerationParams {
	prompt: string;
	image_style: keyof typeof imagePrompts;
	steps: number;
}

export interface ImageResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

export async function generateImage({
	completion_id,
	app_url,
	env,
	args,
}: {
	completion_id: string;
	app_url: string | undefined;
	env: IEnv;
	args: ImageGenerationParams;
}): Promise<ImageResponse> {
	if (!args.prompt) {
		return {
			status: "error",
			name: "create_image",
			content: "Missing prompt",
			data: {},
		};
	}

	try {
		const provider = AIProviderFactory.getProvider("workers-ai");

		const systemPrompt = getTextToImageSystemPrompt(args.image_style);
		const diffusionSteps = args.steps || 4;

		if (diffusionSteps < 1 || diffusionSteps > 8) {
			return {
				status: "error",
				name: "create_image",
				content: "Invalid number of diffusion steps",
				data: {},
			};
		}

		const imageData = await provider.getResponse({
			completion_id,
			model: "@cf/black-forest-labs/flux-1-schnell",
			app_url,
			messages: [
				{
					role: "user",
					// @ts-ignore
					content: [
						{
							type: "text",
							text: `${systemPrompt}\n\n${args.prompt}`,
						},
					],
				},
			],
			env: env,
		});

		return {
			status: "success",
			name: "create_image",
			content: "Image generated successfully",
			data: imageData,
		};
	} catch (error) {
		return {
			status: "error",
			name: "create_image",
			content:
				error instanceof Error ? error.message : "Failed to generate image",
			data: {},
		};
	}
}
