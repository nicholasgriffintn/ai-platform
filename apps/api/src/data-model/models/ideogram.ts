import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "ideogram";

export const ideogramModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("ideogram/ideogram-v3", PROVIDER, {
		name: "Ideogram v3",
		matchingModel: "V_3",
		description:
			"Ideogram v3 is a text-to-image model optimized for prompt fidelity, layout control, and text rendering.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		inputSchema: {
			reference:
				"https://developer.ideogram.ai/api-reference/api-reference/generate-v3",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Prompt used to generate the image.",
					required: true,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducible generations.",
				},
				{
					name: "resolution",
					type: "string",
					description: "Output resolution for the generated image.",
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio for the generated image.",
				},
				{
					name: "rendering_speed",
					type: "string",
					description: "Controls generation speed and quality tradeoffs.",
				},
				{
					name: "magic_prompt",
					type: "string",
					description: "Controls automatic prompt enhancement.",
				},
				{
					name: "negative_prompt",
					type: "string",
					description: "Elements to avoid in the generated image.",
				},
				{
					name: "num_images",
					type: "integer",
					description: "Number of images to generate.",
				},
				{
					name: "color_palette",
					type: "object",
					description: "Preset or custom color palette settings.",
				},
				{
					name: "style_codes",
					type: "array",
					description: "List of style codes to influence aesthetics.",
				},
				{
					name: "style_type",
					type: "string",
					description: "Style guidance for the generation.",
				},
				{
					name: "style_preset",
					type: "string",
					description: "Preset style applied to the generation.",
				},
			],
		},
	}),
]);
