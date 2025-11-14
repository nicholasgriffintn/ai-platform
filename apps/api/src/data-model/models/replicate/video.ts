import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "replicate";

export const replicateModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("replicate-tencent-hunyuan-video", PROVIDER, {
		name: "Hunyuan Video",
		matchingModel:
			"847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405",
		description:
			"A state-of-the-art text-to-video generation model capable of creating high-quality videos with realistic motion from text descriptions .",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 1.25,
		replicateInputSchema: {
			reference: "https://replicate.com/tencent/hunyuan-video",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Primary prompt describing the video scene to render.",
					required: true,
				},
				{
					name: "negative_prompt",
					type: "string",
					description:
						"Text describing elements to avoid in the generated image.",
					default: "",
				},
				{
					name: "video_length",
					type: "number",
					description:
						"Number of frames to generate (must be 4k+1, ex: 49 or 129)",
					default: 129,
				},
				{
					name: "width",
					type: "integer",
					description: "Frame width in pixels.",
					default: 864,
				},
				{
					name: "height",
					type: "integer",
					description: "Frame height in pixels.",
					default: 480,
				},
				{
					name: "infer_steps",
					type: "number",
					description: "Number of denoising steps",
					default: 50,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
			],
		},
	}),
	createModelConfig("replicate-sora-2", PROVIDER, {
		name: "Sora 2",
		matchingModel: "openai/sora-2",
		description: "OpenAI's Flagship video generation with synced audio ",
		strengths: ["creative", "video"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.5,
		modalities: {
			input: ["text"],
			output: ["video"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/openai/sora-2",
			fields: [
				{
					name: "seconds",
					type: "integer",
					description: "Duration of the generated video in seconds.",
					default: 4,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the generated video.",
					default: "portrait",
					enum: ["portrait", "landscape"],
				},
				{
					name: "prompt",
					type: "string",
					description: "A text description of the video to generate",
					required: true,
				},
				{
					name: "input_reference",
					type: ["file", "string"],
					description:
						"An optional image to use as the first frame of the video. The image must be the same aspect ratio as the video.",
				},
			],
		},
	}),
	createModelConfig("replicate-hailuo-2-3", PROVIDER, {
		name: "Hailuo 2.3",
		matchingModel: "minimax/hailuo-2.3",
		description:
			"A high-fidelity video generation model optimized for realistic human motion, cinematic VFX, expressive characters, and strong prompt and style adherence across both text-to-video and image-to-video workflows ",
		strengths: ["creative", "video"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 1,
		modalities: {
			input: ["text"],
			output: ["video"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/minimax/hailuo-2-3",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "A text description of the video to generate",
					required: true,
				},
				{
					name: "first_frame_image",
					type: ["file", "string"],
					description:
						"First frame image for video generation. The output video will have the same aspect ratio as this image.",
				},
				{
					name: "duration",
					type: "integer",
					description: "Duration of the generated video in seconds.",
					default: 6,
				},
				{
					name: "resolution",
					type: "string",
					description: "Resolution of the generated video.",
					default: "768p",
					enum: ["768p", "1080p"],
				},
				{
					name: "prompt_optimizer",
					type: "boolean",
					description: "Whether to use prompt optimization.",
					default: true,
				},
			],
		},
	}),
	createModelConfig("replicate-veo-3-1", PROVIDER, {
		name: "Veo 3.1",
		matchingModel: "google/veo-3.1",
		description:
			"New and improved version of Veo 3, with higher-fidelity video, context-aware audio, reference image and last frame support ",
		strengths: ["creative", "video"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 1,
		modalities: {
			input: ["text"],
			output: ["video"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/google/veo-3-1",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "A text description of the video to generate",
					required: true,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the generated video.",
					default: "16:9",
					enum: ["16:9", "9:16"],
				},
				{
					name: "duration",
					type: "integer",
					description: "Duration of the generated video in seconds.",
					default: 6,
				},
				{
					name: "image",
					type: ["file", "string"],
					description:
						"Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose.",
				},
				{
					name: "last_frame",
					type: ["file", "string"],
					description:
						"Binding image for interpolation. When provided with an input image, creates a transition between the two images.",
				},
				{
					name: "resolution",
					type: "string",
					description: "Resolution of the generated video.",
					default: "720p",
					enum: ["720p", "1080p"],
				},
				{
					name: "reference_images",
					type: ["array"],
					description:
						"1 to 3 reference images for subject-consistent generation (reference-to-video, or R2V). Reference images only work with 16:9 aspect ratio and 8-second duration. Last frame is ignored if reference images are provided.",
					default: [],
				},
				{
					name: "generate_audio",
					type: "boolean",
					description: "Whether to generate audio for the video.",
					default: true,
				},
				{
					name: "seed",
					type: "integer",
					description: "A random seed for the video generation.",
				},
			],
		},
	}),
	createModelConfig("replicate-google-veo-3-1-fast", PROVIDER, {
		name: "Google Veo 3.1 Fast",
		matchingModel: "google/veo-3.1-fast",
		description:
			"New and improved version of Veo 3 Fast, with higher-fidelity video, context-aware audio and last frame support ",
		modalities: {
			input: ["text", "image"],
			output: ["video"],
		},
		costPerRun: 5,
		replicateInputSchema: {
			reference: "https://replicate.com/google/veo-3-1-fast",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "A text description of the video to generate",
					required: true,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the generated video.",
					default: "16:9",
					enum: ["16:9", "9:16"],
				},
				{
					name: "duration",
					type: "integer",
					description: "Duration of the generated video in seconds.",
					default: 8,
				},
				{
					name: "image",
					type: ["file", "string"],
					description:
						"Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose.",
				},
				{
					name: "last_frame",
					type: ["file", "string"],
					description:
						"Binding image for interpolation. When provided with an input image, creates a transition between the two images.",
				},
				{
					name: "negative_prompt",
					type: "string",
					description:
						"Text describing elements to avoid in the generated video.",
					default: "",
				},
				{
					name: "resolution",
					type: "string",
					description: "Resolution of the generated video.",
					default: "1080p",
					enum: ["720p", "1080p"],
				},
				{
					name: "generate_audio",
					type: "boolean",
					description: "Whether to generate audio for the video.",
					default: true,
				},
				{
					name: "seed",
					type: "integer",
					description: "A random seed for the video generation.",
				},
			],
		},
	}),
]);
