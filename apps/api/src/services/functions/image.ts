import { imagePrompts } from "~/lib/prompts/image";
import { replicateModelConfig } from "~/data-model/models/replicate";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import {
	type ImageGenerationParams,
	type ImageResponse,
	generateImage,
} from "~/services/generate/image";
import type { IRequest } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";
import { getModelIdsByOutput } from "~/utils/models";

const IMAGE_PROVIDERS = ["workers-ai", "replicate"] as const;

const IMAGE_MODELS = [
	...getModelIdsByOutput(replicateModelConfig, "replicate", "image"),
	...getModelIdsByOutput(workersAiModelConfig, "workers-ai", "image"),
].sort();

export const create_image: ApiToolDefinition = {
	name: "create_image",
	description:
		"Generates visual imagery based on detailed text descriptions. Use when users request illustrations, artwork, diagrams, or visual representations.",
	inputSchema: jsonSchemaToZod({
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
			provider: {
				type: "string",
				description: "Image generation provider",
				enum: Array.from(IMAGE_PROVIDERS),
				default: "workers-ai",
			},
			model: {
				type: "string",
				description: "Specific image generation model to use",
				enum: IMAGE_MODELS,
			},
			aspect_ratio: {
				type: "string",
				description: "Aspect ratio for the generated image",
			},
			width: {
				type: "integer",
				description: "Width of the generated image in pixels",
			},
			height: {
				type: "integer",
				description: "Height of the generated image in pixels",
			},
		},
		required: ["prompt"],
	}),
	type: "premium",
	costPerCall: 1,
	execute: async (args, context) => {
		const req = context.request;
		const completion_id = context.completionId;
		const app_url = context.appUrl;

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
