import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "fal";

export const falModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("fal-ai/qwen-image", PROVIDER, {
		name: "Qwen Image",
		matchingModel: "fal-ai/qwen-image",
		description:
			"Qwen Image is a large-scale image generation model capable of generating high-quality images from text descriptions.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		inputSchema: {
			reference: "https://fal.ai/models/fal-ai/qwen-image",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
			],
		},
	}),
]);
