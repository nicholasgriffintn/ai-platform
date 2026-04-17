import type { InputSchemaInputSchemaDescriptor, ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "workers-ai";

const veo3InputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{
			name: "prompt",
			type: "string",
			description: "Text prompt",
			required: true,
		},
		{
			name: "image_input",
			type: ["file", "string"],
			description: "Optional reference image for image-to-video",
		},
		{
			name: "duration",
			type: "string",
			description: "Video duration",
			default: "6s",
			enum: ["4s", "6s", "8s"],
			required: true,
		},
		{
			name: "aspect_ratio",
			type: "string",
			description: "Aspect ratio",
			default: "16:9",
			enum: ["16:9", "9:16", "1:1"],
			required: true,
		},
		{
			name: "resolution",
			type: "string",
			description: "Output resolution",
			default: "720p",
			enum: ["720p", "1080p"],
			required: true,
		},
		{
			name: "generate_audio",
			type: "boolean",
			description: "Generate audio with the video",
			default: true,
			required: true,
		},
	],
};

const hailuo23InputSchema: InputSchemaInputSchemaDescriptor = {
	fields: [
		{ name: "prompt", type: "string", description: "Text prompt" },
		{
			name: "first_frame_image",
			type: ["file", "string"],
			description: "Optional first frame image",
		},
		{
			name: "prompt_optimizer",
			type: "boolean",
			description: "Enable prompt optimisation",
			default: true,
			required: true,
		},
		{
			name: "fast_pretreatment",
			type: "boolean",
			description: "Enable fast pretreatment",
			default: false,
			required: true,
		},
		{
			name: "duration",
			type: "integer",
			description: "Video duration in seconds",
			default: 6,
			enum: [6, 10],
			required: true,
		},
		{
			name: "resolution",
			type: "string",
			description: "Output resolution",
			default: "768P",
			enum: ["768P", "1080P"],
			required: true,
		},
		{ name: "callback_url", type: "string", description: "Callback URL" },
	],
};

export const workersAiModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("workers-ai-pixverse-v6", PROVIDER, {
		name: "PixVerse V6",
		matchingModel: "pixverse/v6",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt",
					required: true,
				},
				{
					name: "negative_prompt",
					type: "string",
					description: "Negative prompt",
				},
				{
					name: "image_input",
					type: ["file", "string"],
					description: "Optional reference image",
				},
				{
					name: "duration",
					type: "integer",
					description: "Video duration in seconds",
					default: 5,
					required: true,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio",
					default: "16:9",
					enum: ["16:9", "4:3", "1:1", "3:4", "9:16", "2:3", "3:2", "21:9"],
					required: true,
				},
				{
					name: "quality",
					type: "string",
					description: "Video quality",
					default: "720p",
					enum: ["360p", "540p", "720p", "1080p"],
					required: true,
				},
				{ name: "seed", type: "integer", description: "Random seed" },
				{
					name: "generate_audio",
					type: "boolean",
					description: "Generate audio",
					default: true,
					required: true,
				},
			],
		},
	}),
	createModelConfig("workers-ai-pixverse-v5-6", PROVIDER, {
		name: "PixVerse V5.6",
		matchingModel: "pixverse/v5.6",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt",
					required: true,
				},
				{
					name: "negative_prompt",
					type: "string",
					description: "Negative prompt",
				},
				{
					name: "image_input",
					type: ["file", "string"],
					description: "Optional reference image",
				},
				{
					name: "duration",
					type: "integer",
					description: "Video duration in seconds",
					default: 5,
					enum: [5, 8, 10],
					required: true,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio",
					default: "16:9",
					enum: ["16:9", "4:3", "1:1", "3:4", "9:16", "2:3", "3:2", "21:9"],
					required: true,
				},
				{
					name: "quality",
					type: "string",
					description: "Video quality",
					default: "720p",
					enum: ["360p", "540p", "720p", "1080p"],
					required: true,
				},
				{ name: "seed", type: "integer", description: "Random seed" },
				{
					name: "motion_mode",
					type: "string",
					description: "Motion mode",
					enum: ["normal", "fast"],
				},
				{
					name: "generate_audio",
					type: "boolean",
					description: "Generate audio",
					default: true,
					required: true,
				},
			],
		},
	}),
	createModelConfig("workers-ai-vidu-q3-turbo", PROVIDER, {
		name: "Vidu Q3 Turbo",
		matchingModel: "vidu/q3-turbo",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: {
			fields: [
				{ name: "prompt", type: "string", description: "Text prompt" },
				{
					name: "start_image",
					type: ["file", "string"],
					description: "Optional start image",
				},
				{
					name: "end_image",
					type: ["file", "string"],
					description: "Optional end image",
				},
				{
					name: "duration",
					type: "integer",
					description: "Video duration",
					default: 5,
					required: true,
				},
				{
					name: "resolution",
					type: "string",
					description: "Video resolution",
					default: "720p",
					enum: ["540p", "720p", "1080p"],
					required: true,
				},
				{ name: "audio", type: "boolean", description: "Synchronise audio" },
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio",
					enum: ["16:9", "9:16", "3:4", "4:3", "1:1"],
				},
			],
		},
	}),
	createModelConfig("workers-ai-vidu-q3-pro", PROVIDER, {
		name: "Vidu Q3 Pro",
		matchingModel: "vidu/q3-pro",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: {
			fields: [
				{ name: "prompt", type: "string", description: "Text prompt" },
				{
					name: "start_image",
					type: ["file", "string"],
					description: "Optional start image",
				},
				{
					name: "end_image",
					type: ["file", "string"],
					description: "Optional end image",
				},
				{
					name: "duration",
					type: "integer",
					description: "Video duration",
					default: 5,
					required: true,
				},
				{
					name: "resolution",
					type: "string",
					description: "Video resolution",
					default: "720p",
					enum: ["540p", "720p", "1080p"],
					required: true,
				},
				{ name: "audio", type: "boolean", description: "Synchronise audio" },
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio",
					enum: ["16:9", "9:16", "3:4", "4:3", "1:1"],
				},
			],
		},
	}),
	createModelConfig("workers-ai-runway-gen-4-5", PROVIDER, {
		name: "Runway Gen-4.5",
		matchingModel: "runwayml/gen-4.5",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt",
					required: true,
				},
				{
					name: "image_input",
					type: ["file", "string"],
					description: "Optional image for image-to-video",
				},
				{
					name: "ratio",
					type: "string",
					description: "Resolution and aspect ratio",
					default: "1280:720",
					enum: [
						"1280:720",
						"720:1280",
						"1104:832",
						"960:960",
						"832:1104",
						"1584:672",
					],
					required: true,
				},
				{
					name: "duration",
					type: "integer",
					description: "Video duration in seconds",
					default: 5,
					required: true,
				},
				{ name: "seed", type: "integer", description: "Random seed" },
				{
					name: "content_moderation",
					type: "object",
					description: "Content moderation settings",
				},
			],
		},
	}),
	createModelConfig("workers-ai-minimax-hailuo-2-3-fast", PROVIDER, {
		name: "Hailuo 2.3 Fast",
		matchingModel: "minimax/hailuo-2.3-fast",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: {
			fields: [
				{
					name: "first_frame_image",
					type: ["file", "string"],
					description: "First frame image",
					required: true,
				},
				...hailuo23InputSchema.fields.filter(
					(field) => field.name !== "first_frame_image",
				),
			],
		},
	}),
	createModelConfig("workers-ai-minimax-hailuo-2-3", PROVIDER, {
		name: "Hailuo 2.3",
		matchingModel: "minimax/hailuo-2.3",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: hailuo23InputSchema,
	}),
	createModelConfig("workers-ai-google-veo-3", PROVIDER, {
		name: "Veo 3",
		matchingModel: "google/veo-3",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: veo3InputSchema,
	}),
	createModelConfig("workers-ai-google-veo-3-1", PROVIDER, {
		name: "Veo 3.1",
		matchingModel: "google/veo-3.1",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: veo3InputSchema,
	}),
	createModelConfig("workers-ai-google-veo-3-fast", PROVIDER, {
		name: "Veo 3 Fast",
		matchingModel: "google/veo-3-fast",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: veo3InputSchema,
	}),
	createModelConfig("workers-ai-google-veo-3-1-fast", PROVIDER, {
		name: "Veo 3.1 Fast",
		matchingModel: "google/veo-3.1-fast",
		modalities: { input: ["text", "image"], output: ["video"] },
		inputSchema: veo3InputSchema,
	}),
]);
