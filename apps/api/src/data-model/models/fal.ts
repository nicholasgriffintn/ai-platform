import type { ModelConfig } from "@assistant/schemas";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "fal";

export const falModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("fal-ai/qwen-image", PROVIDER, {
		name: "Qwen Image",
		matchingModel: "fal-ai/qwen-image",
		description:
			"Qwen Image is a large-scale image generation model capable of generating high-quality images from text descriptions.",
		strengths: ["creative", "image"],
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
		reliability: 3,
		artificialAnalysis: {
			intelligenceIndex: null,
			codingIndex: null,
			agenticIndex: null,
			intelligenceIndexVersion: null,
			mediaScores: [
				{
					key: "text_to_imageElo",
					label: "Text-to-image arena",
					value: 1060,
					min: 800,
					max: 1400,
					confidenceInterval95: 8,
				},
			],
		},
	}),
]);
