import type { InputSchemaInputSchemaDescriptor, ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "workers-ai";

const recraftV4InputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{
			name: "prompt",
			type: "string",
			description: "Text prompt",
			required: true,
		},
		{ name: "size", type: "string", description: "Output size preset" },
		{ name: "style", type: "string", description: "Style preset" },
		{ name: "substyle", type: "string", description: "Substyle preset" },
		{
			name: "controls",
			type: "object",
			description: "Optional colour and background controls",
		},
	],
};

const seedream45InputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{
			name: "prompt",
			type: "string",
			description: "Text prompt",
			required: true,
		},
		{
			name: "image_input",
			type: "array",
			description: "Optional input image URLs",
		},
		{
			name: "size",
			type: "string",
			description: "Output size",
			enum: ["2K", "4K"],
		},
		{
			name: "aspect_ratio",
			type: "string",
			description: "Aspect ratio",
			enum: [
				"match_input_image",
				"1:1",
				"4:3",
				"3:4",
				"16:9",
				"9:16",
				"3:2",
				"2:3",
				"21:9",
			],
		},
		{
			name: "sequential_image_generation",
			type: "string",
			description: "Sequential image generation mode",
			enum: ["disabled", "auto"],
		},
		{
			name: "max_images",
			type: "integer",
			description: "Maximum number of generated images",
		},
		{
			name: "disable_safety_checker",
			type: "boolean",
			description: "Disable the safety checker",
		},
	],
};

const seedream5LiteInputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{
			name: "prompt",
			type: "string",
			description: "Text prompt",
			required: true,
		},
		{
			name: "image_input",
			type: "array",
			description: "Optional input image URLs",
		},
		{
			name: "size",
			type: "string",
			description: "Output size",
			enum: ["2K", "3K"],
		},
		{
			name: "aspect_ratio",
			type: "string",
			description: "Aspect ratio",
			enum: [
				"match_input_image",
				"1:1",
				"4:3",
				"3:4",
				"16:9",
				"9:16",
				"3:2",
				"2:3",
				"21:9",
			],
		},
		{
			name: "sequential_image_generation",
			type: "string",
			description: "Sequential image generation mode",
			enum: ["disabled", "auto"],
		},
		{
			name: "max_images",
			type: "integer",
			description: "Maximum number of generated images",
		},
		{
			name: "output_format",
			type: "string",
			description: "Output format",
			enum: ["png", "jpeg"],
		},
	],
};

const seedream40InputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{
			name: "prompt",
			type: "string",
			description: "Text prompt",
			required: true,
		},
		{
			name: "size",
			type: "string",
			description: "Output size",
			enum: ["1K", "2K", "4K", "custom"],
		},
		{
			name: "aspect_ratio",
			type: "string",
			description: "Aspect ratio",
			enum: [
				"match_input_image",
				"1:1",
				"4:3",
				"3:4",
				"16:9",
				"9:16",
				"3:2",
				"2:3",
				"21:9",
			],
		},
		{ name: "width", type: "integer", description: "Custom width in pixels" },
		{ name: "height", type: "integer", description: "Custom height in pixels" },
		{
			name: "enhance_prompt",
			type: "boolean",
			description: "Enhance the input prompt",
		},
	],
};

const nanoBananaInputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{
			name: "prompt",
			type: "string",
			description: "Text prompt",
			required: true,
		},
		{
			name: "image_input",
			type: "array",
			description: "Optional input images",
		},
		{
			name: "aspect_ratio",
			type: "string",
			description: "Aspect ratio",
			enum: [
				"1:1",
				"2:3",
				"3:2",
				"3:4",
				"4:3",
				"4:5",
				"5:4",
				"9:16",
				"16:9",
				"21:9",
				"match_input_image",
			],
		},
		{
			name: "output_format",
			type: "string",
			description: "Output format",
			enum: ["jpg", "png", "webp"],
		},
		{
			name: "image_size",
			type: "string",
			description: "Image size preset",
			enum: ["1K", "2K", "4K"],
		},
	],
};

export const workersAiModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("workers-ai-alibaba-wan-2-6-image", PROVIDER, {
		name: "Wan 2.6 Image",
		matchingModel: "alibaba/wan-2.6-image",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt",
					required: true,
				},
				{
					name: "size",
					type: "string",
					description: "Image size WIDTHxHEIGHT",
				},
				{
					name: "negative_prompt",
					type: "string",
					description: "Negative prompt",
				},
				{ name: "n", type: "integer", description: "Image count", enum: [1] },
			],
		},
	}),
	createModelConfig("workers-ai-openai-gpt-image-1-5", PROVIDER, {
		name: "GPT Image 1.5",
		matchingModel: "openai/gpt-image-1.5",
		modalities: { input: ["text", "image"], output: ["image"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Generation or edit prompt",
					required: true,
				},
				{
					name: "image",
					type: ["file", "string"],
					description: "Optional input image for edits",
				},
				{
					name: "quality",
					type: "string",
					description: "Image quality",
					enum: ["low", "medium", "high", "auto"],
				},
				{
					name: "size",
					type: "string",
					description: "Output size",
					enum: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
				},
				{
					name: "style",
					type: "string",
					description: "Image style",
					enum: ["vivid", "natural"],
				},
			],
		},
	}),
	createModelConfig("workers-ai-google-imagen-4", PROVIDER, {
		name: "Imagen 4",
		matchingModel: "google/imagen-4",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt",
					required: true,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio",
					enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
				},
				{
					name: "person_generation",
					type: "string",
					description: "Controls generation of people",
					enum: ["dont_allow", "allow_adult", "allow_all"],
				},
			],
		},
	}),
	createModelConfig("workers-ai-recraft-v4", PROVIDER, {
		name: "Recraft V4",
		matchingModel: "recraft/recraftv4",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: recraftV4InputSchema,
	}),
	createModelConfig("workers-ai-recraft-v4-pro", PROVIDER, {
		name: "Recraft V4 Pro",
		matchingModel: "recraft/recraftv4-pro",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: recraftV4InputSchema,
	}),
	createModelConfig("workers-ai-recraft-v4-vector", PROVIDER, {
		name: "Recraft V4 Vector",
		matchingModel: "recraft/recraftv4-vector",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: recraftV4InputSchema,
	}),
	createModelConfig("workers-ai-recraft-v4-pro-vector", PROVIDER, {
		name: "Recraft V4 Pro Vector",
		matchingModel: "recraft/recraftv4-pro-vector",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: recraftV4InputSchema,
	}),
	createModelConfig("workers-ai-bfl-flux-2-klein-9b", PROVIDER, {
		name: "FLUX 2 Klein 9B",
		matchingModel: "black-forest-labs/flux-2-klein-9b",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt",
					required: true,
				},
				{ name: "width", type: "number", description: "Output width" },
				{ name: "height", type: "number", description: "Output height" },
				{ name: "num_steps", type: "number", description: "Sampling steps" },
				{ name: "guidance", type: "number", description: "Guidance scale" },
				{ name: "seed", type: "number", description: "Random seed" },
			],
		},
	}),
	createModelConfig("workers-ai-bytedance-seedream-5-lite", PROVIDER, {
		name: "Seedream 5 Lite",
		matchingModel: "bytedance/seedream-5-lite",
		modalities: { input: ["text", "image"], output: ["image"] },
		inputSchema: seedream5LiteInputSchema,
	}),
	createModelConfig("workers-ai-bytedance-seedream-4-5", PROVIDER, {
		name: "Seedream 4.5",
		matchingModel: "bytedance/seedream-4.5",
		modalities: { input: ["text", "image"], output: ["image"] },
		inputSchema: seedream45InputSchema,
	}),
	createModelConfig("workers-ai-bytedance-seedream-4-0", PROVIDER, {
		name: "Seedream 4.0",
		matchingModel: "bytedance/seedream-4.0",
		modalities: { input: ["text"], output: ["image"] },
		inputSchema: seedream40InputSchema,
	}),
	createModelConfig("workers-ai-google-nano-banana", PROVIDER, {
		name: "Nano Banana",
		matchingModel: "google/nano-banana",
		modalities: { input: ["text", "image"], output: ["image"] },
		inputSchema: nanoBananaInputSchema,
	}),
	createModelConfig("workers-ai-google-nano-banana-pro", PROVIDER, {
		name: "Nano Banana Pro",
		matchingModel: "google/nano-banana-pro",
		modalities: { input: ["text", "image"], output: ["image"] },
		inputSchema: nanoBananaInputSchema,
	}),
	createModelConfig("workers-ai-google-nano-banana-2", PROVIDER, {
		name: "Nano Banana 2",
		matchingModel: "google/nano-banana-2",
		modalities: { input: ["text", "image"], output: ["image"] },
		inputSchema: {
			fields: [
				...nanoBananaInputSchema.fields,
				{
					name: "google_search",
					type: "boolean",
					description: "Enable Google search grounding",
				},
				{
					name: "image_search",
					type: "boolean",
					description: "Enable image search grounding",
				},
				{
					name: "resolution",
					type: "string",
					description: "Output resolution",
					enum: ["1K", "2K", "4K"],
				},
			],
		},
	}),
]);
