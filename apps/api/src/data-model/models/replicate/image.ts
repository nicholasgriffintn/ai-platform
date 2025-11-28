import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "replicate";

export const replicateModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("replicate-bytedance-sdxl-lightning-4step", PROVIDER, {
		name: "SDXL Lightning 4-Step",
		matchingModel:
			"5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
		description:
			"Bytedance's SDXL Lightning model tuned for ultra-fast 4-step diffusion image generation with high fidelity outputs.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.0016,
		replicateInputSchema: {
			reference: "https://replicate.com/bytedance/sdxl-lightning-4step",
			fields: [
				{
					name: "prompt",
					type: "string",
					description:
						"Positive text prompt describing the desired image content.",
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
					name: "num_outputs",
					type: "integer",
					description: "Number of images to generate per prediction (1-4).",
					default: 1,
				},
				{
					name: "guidance_scale",
					type: "number",
					description:
						"Classifier-free guidance scale controlling prompt adherence.",
					default: 0,
				},
				{
					name: "width",
					type: "integer",
					description: "Output image width in pixels.",
					default: 1024,
				},
				{
					name: "height",
					type: "integer",
					description: "Output image height in pixels.",
					default: 1024,
				},
			],
		},
	}),
	createModelConfig("replicate-flux-2-pro", PROVIDER, {
		name: "FLUX 2 Pro",
		matchingModel: "black-forest-labs/flux-2-pro",
		description:
			"Flux 2 Pro is an image generation and editing model by Black Forest Labs. It creates high-quality images from text prompts and can edit existing images using natural language instructions.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.015,
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/black-forest-labs/flux-2-pro",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
				{
					name: "input_images",
					type: ["file", "string"],
					description:
						"A list of input images for image-to-image generation. Maximum 8 images. Must be jpeg, png, gif, or webp.",
					required: false,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description:
						"Aspect ratio for the generated image. Use 'match_input_image' to match the first input image's aspect ratio.",
					default: "1:1",
					enum: [
						"1:1",
						"16:9",
						"3:2",
						"2:3",
						"4:5",
						"5:4",
						"9:16",
						"3:4",
						"4:3",
						"match_input_image",
						"custom",
					],
				},
				{
					name: "resolution",
					type: "string",
					description:
						"Resolution in megapixels. Up to 4 MP is possible, but 2 MP or below is recommended. The maximum image size is 2048x2048, which means that high-resolution images may not respect the resolution if aspect ratio is not 1:1. Resolution is not used when aspect_ratio is 'custom'. When aspect_ratio is 'match_input_image', use 'match_input_image' to match the input image's resolution (clamped to 0.5-4 MP).",
					default: "1 MP",
					enum: ["1 MP", "2 MP", "4 MP", "0.5MP", "match_input_image"],
				},
				{
					name: "width",
					type: "integer",
					description:
						"Width of the generated image. Only used when aspect_ratio=custom. Must be a multiple of 32 (if it's not, it will be rounded to nearest multiple of 32).",
					default: 1024,
				},
				{
					name: "height",
					type: "integer",
					description:
						"Height of the generated image. Only used when aspect_ratio=custom. Must be a multiple of 32 (if it's not, it will be rounded to nearest multiple of 32).",
					default: 1024,
				},
				{
					name: "safety_tolerance",
					type: "integer",
					description:
						"Safety tolerance, 1 is most strict and 5 is most permissive",
					default: 2,
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format.",
					default: "webp",
					enum: ["webp", "jpg", "png"],
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
			],
		},
	}),
	createModelConfig("replicate-flux-2-flex", PROVIDER, {
		name: "FLUX 2 Flex",
		matchingModel: "black-forest-labs/flux-2-flex",
		description:
			"Flux 2 Flex is an image generation and editing model by Black Forest Labs. It creates high-quality images from text prompts and can edit existing images using natural language instructions.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.06,
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/black-forest-labs/flux-2-flex",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
				{
					name: "input_images",
					type: ["file", "string"],
					description:
						"A list of input images for image-to-image generation. Maximum 8 images. Must be jpeg, png, gif, or webp.",
					required: false,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description:
						"Aspect ratio for the generated image. Use 'match_input_image' to match the first input image's aspect ratio.",
					default: "1:1",
					enum: [
						"1:1",
						"16:9",
						"3:2",
						"2:3",
						"4:5",
						"5:4",
						"9:16",
						"3:4",
						"4:3",
						"match_input_image",
						"custom",
					],
				},
				{
					name: "resolution",
					type: "string",
					description:
						"Resolution in megapixels. Up to 4 MP is possible, but 2 MP or below is recommended. The maximum image size is 2048x2048, which means that high-resolution images may not respect the resolution if aspect ratio is not 1:1. Resolution is not used when aspect_ratio is 'custom'. When aspect_ratio is 'match_input_image', use 'match_input_image' to match the input image's resolution (clamped to 0.5-4 MP).",
					default: "1 MP",
					enum: ["1 MP", "2 MP", "4 MP", "0.5MP", "match_input_image"],
				},
				{
					name: "width",
					type: "integer",
					description:
						"Width of the generated image. Only used when aspect_ratio=custom. Must be a multiple of 32 (if it's not, it will be rounded to nearest multiple of 32).",
					default: 1024,
				},
				{
					name: "height",
					type: "integer",
					description:
						"Height of the generated image. Only used when aspect_ratio=custom. Must be a multiple of 32 (if it's not, it will be rounded to nearest multiple of 32).",
					default: 1024,
				},
				{
					name: "safety_tolerance",
					type: "integer",
					description:
						"Safety tolerance, 1 is most strict and 5 is most permissive",
					default: 2,
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format.",
					default: "webp",
					enum: ["webp", "jpg", "png"],
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
				{
					name: "prompt_upsampling",
					type: "boolean",
					description: "Automatically enhance prompt.",
					default: false,
				},
				{
					name: "steps",
					type: "integer",
					description: "Number of inference steps",
					default: 30,
				},
				{
					name: "guidance",
					type: "integer",
					description:
						"Guidance scale for generation. Controls how closely the output follows the prompt",
					default: 4.5,
				},
			],
		},
	}),
	createModelConfig("replicate-flux-2-dev", PROVIDER, {
		name: "FLUX 2 Dev",
		matchingModel: "black-forest-labs/flux-2-dev",
		description:
			"Flux 2 Dev is an image generation and editing model by Black Forest Labs. It creates high-quality images from text prompts and can edit existing images using natural language instructions.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.06,
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/black-forest-labs/flux-2-dev",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
				{
					name: "input_images",
					type: ["file", "string"],
					description:
						"List of input images for image-to-image generation. Maximum 4 images. Must be jpeg, png, gif, or webp.",
					required: false,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description:
						"Aspect ratio for the generated image. Use 'match_input_image' to match the first input image's aspect ratio.",
					default: "1:1",
					enum: [
						"1:1",
						"16:9",
						"3:2",
						"2:3",
						"4:5",
						"5:4",
						"9:16",
						"3:4",
						"4:3",
						"match_input_image",
						"custom",
					],
				},
				{
					name: "width",
					type: "integer",
					description:
						"Width of the generated image. Only used when aspect_ratio=custom. Must be a multiple of 32 (if it's not, it will be rounded to nearest multiple of 32).",
					default: 1024,
				},
				{
					name: "height",
					type: "integer",
					description:
						"Height of the generated image. Only used when aspect_ratio=custom. Must be a multiple of 32 (if it's not, it will be rounded to nearest multiple of 32).",
					default: 1024,
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format.",
					default: "webp",
					enum: ["webp", "jpg", "png"],
				},
				{
					name: "output_quality",
					type: "integer",
					description:
						"Quality when saving the output images, from 0 to 100. 100 is best quality, 0 is lowest quality. Not relevant for .png outputs..",
					default: 90,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
				{
					name: "disable_safety_checker",
					type: "boolean",
					description: "Disable safety checker for generated images.",
					default: false,
				},
			],
		},
	}),
	createModelConfig("replicate-flux-1.1-pro", PROVIDER, {
		name: "FLUX 1.1 Pro",
		matchingModel: "black-forest-labs/flux-1.1-pro",
		description:
			"Black Forest Labs' flagship text-to-image model with excellent quality, prompt adherence, and 6x faster generation.",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.04,
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/black-forest-labs/flux-1.1-pro",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
				{
					name: "image_prompt",
					type: ["file", "string"],
					description:
						"Image to use with Flux Redux. This is used together with the text prompt to guide the generation towards the composition of the image_prompt. Must be jpeg, png, gif, or webp.",
					required: false,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the output image.",
					default: "1:1",
				},
				{
					name: "width",
					type: "integer",
					description: "Width of output image (256-1440).",
					default: 1024,
				},
				{
					name: "height",
					type: "integer",
					description: "Height of output image (256-1440).",
					default: 1024,
				},
				{
					name: "prompt_upsampling",
					type: "boolean",
					description: "Automatically enhance prompt.",
					default: false,
				},
				{
					name: "safety_tolerance",
					type: "integer",
					description: "Safety level (1-5).",
					default: 2,
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format.",
					default: "webp",
					enum: ["webp", "jpg", "png"],
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
			],
		},
	}),
	createModelConfig("replicate-sd3.5large", PROVIDER, {
		name: "Stable Diffusion 3.5 Large",
		matchingModel: "stability-ai/stable-diffusion-3.5-large",
		description:
			"A text-to-image model that generates high-resolution images with fine details. It supports various artistic styles and produces diverse outputs from the same prompt, thanks to Query-Key Normalization. ",
		strengths: ["creative"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.0055,
		modalities: {
			input: ["text", "image"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/stability-ai/sdxl",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt for image generation.",
					required: true,
				},
				{
					name: "negative_prompt",
					type: "string",
					description: "Things to avoid.",
					default: "",
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the output image.",
					default: "1:1",
				},
				{
					name: "cfg",
					type: "number",
					description:
						"The guidance scale tells the model how similar the output should be to the prompt.",
					default: 4.5,
				},
				{
					name: "image",
					type: ["file", "string"],
					description:
						"Input image for image to image mode. The aspect ratio of your output will match this image.",
				},
				{
					name: "prompt_strength",
					type: "number",
					description: "Prompt strength for img2img (0-1).",
					default: 0.8,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed.",
				},
			],
		},
	}),
	createModelConfig("replicate-real-esrgan", PROVIDER, {
		name: "Real-ESRGAN",
		matchingModel: "nightmareai/real-esrgan",
		description:
			"Real-ESRGAN with optional face correction and adjustable upscale",
		strengths: ["creative", "analysis"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.002,
		modalities: {
			input: ["image"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/nightmareai/real-esrgan",
			fields: [
				{
					name: "image",
					type: ["file", "string"],
					description: "Input image to upscale.",
					required: true,
				},
				{
					name: "scale",
					type: "number",
					description: "Upscaling factor.",
					default: 4,
					enum: [2, 4],
				},
				{
					name: "face_enhance",
					type: "boolean",
					description: "Run GFPGAN face enhancement along with upscaling",
					default: false,
				},
			],
		},
	}),
	createModelConfig("replicate-rembg", PROVIDER, {
		name: "Remove Background",
		matchingModel: "bria/remove-background",
		description: "Bria AI's remove background model ",
		strengths: ["creative", "analysis"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.018,
		modalities: {
			input: ["image"],
			output: ["image"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/bria/remove-background",
			fields: [
				{
					name: "image",
					type: ["file", "string"],
					description: "Input image for background removal.",
					required: false,
				},
				{
					name: "image_url",
					type: ["file", "string"],
					description: "Input image for background removal.",
					required: false,
				},
				{
					name: "preserve_partial_alpha",
					type: "boolean",
					description:
						"Controls whether partially transparent areas from the input image are retained in the output after background removal, if the input includes an alpha channel. When true: Partially transparent pixels preserve their original alpha values in the output. When false: All non-background areas in the output are rendered fully opaque. Has no effect if the input image does not include an alpha channel.",
					default: true,
				},
				{
					name: "content_moderation",
					type: "boolean",
					description: "Use alpha matting for better edges.",
					default: false,
				},
			],
		},
	}),
	createModelConfig("replicate-google-nano-banana-pro", PROVIDER, {
		name: "Google Nano Banana Pro",
		matchingModel: "google/nano-banana-pro",
		description:
			"Google's state of the art image generation and editing model 🍌🍌 ",
		modalities: {
			input: ["text", "image"],
			output: ["image"],
		},
		costPerRun: 0.039,
		replicateInputSchema: {
			reference: "https://replicate.com/google/nano-banana-pro",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
				{
					name: "image_input",
					type: "array",
					description:
						"Input images to transform or use as reference (supports up to 14 images)",
					required: false,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the output image.",
					default: "match_input_image",
					enum: [
						"match_input_image",
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
					],
				},
				{
					name: "resolution",
					type: "string",
					description: "Output resolution.",
					default: "2K",
					enum: ["1K", "2K", "4K"],
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format.",
					default: "jpg",
					enum: ["png", "jpg"],
				},
				{
					name: "safety_filter_level",
					type: "string",
					description: "Output format.",
					default: "block_only_high",
					enum: [
						"block_only_high",
						"block_only_medium_and_above",
						"block_only_low_and_above",
					],
				},
			],
		},
	}),
	createModelConfig("replicate-google-nano-banana", PROVIDER, {
		name: "Google Nano Banana",
		matchingModel: "google/nano-banana",
		description: "Google's latest image editing model in Gemini 2.5 ",
		modalities: {
			input: ["text", "image"],
			output: ["image"],
		},
		costPerRun: 0.039,
		replicateInputSchema: {
			reference: "https://replicate.com/google/nano-banana",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired image.",
					required: true,
				},
				{
					name: "image_input",
					type: "array",
					description:
						"Input images to transform or use as reference (supports multiple images)",
					required: false,
				},
				{
					name: "aspect_ratio",
					type: "string",
					description: "Aspect ratio of the output image.",
					default: "match_input_image",
					enum: [
						"match_input_image",
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
					],
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format.",
					default: "jpg",
					enum: ["png", "jpg"],
				},
			],
		},
	}),
]);
