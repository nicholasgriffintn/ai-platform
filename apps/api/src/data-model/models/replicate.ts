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
		type: ["text-to-image"],
		strengths: ["creative", "image_generation"],
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
	createModelConfig("replicate-tencent-hunyuan-video", PROVIDER, {
		name: "Hunyuan Video",
		matchingModel:
			"847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405",
		description:
			"A state-of-the-art text-to-video generation model capable of creating high-quality videos with realistic motion from text descriptions .",
		type: ["text-to-video"],
		strengths: ["creative", "video_generation"],
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
	createModelConfig("replicate-musicgen", PROVIDER, {
		name: "MusicGen",
		matchingModel:
			"671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
		description:
			"Meta's MusicGen model for prompt-based music composition supporting conditioning on input audio clips.",
		type: ["text-to-audio"],
		strengths: ["creative", "audio", "text-to-audio"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.08,
		replicateInputSchema: {
			reference: "https://replicate.com/meta/musicgen",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Natural language description of the desired music.",
					required: true,
				},
				{
					name: "input_audio",
					type: ["file", "string"],
					description:
						"Optional audio file URL or handle to condition the generation.",
				},
				{
					name: "duration",
					type: "number",
					description: "Desired duration of the generated music in seconds.",
					default: 8,
				},
				{
					name: "model_version",
					type: "string",
					description: "MusicGen checkpoint to use (melody, medium, large).",
					default: "stereo-melody-large",
					enum: [
						"melody-large",
						"stereo-large",
						"stereo-melody-large",
						"large",
					],
				},
				{
					name: "top_k",
					type: "integer",
					description: "Limits sampling to the most likely tokens.",
					default: 250,
				},
				{
					name: "top_p",
					type: "number",
					description: "Top-p nucleus sampling threshold.",
					default: 0,
				},
				{
					name: "temperature",
					type: "number",
					description: "Sampling temperature controlling randomness.",
					default: 1,
				},
				{
					name: "continuation",
					type: "boolean",
					description:
						"If `True`, generated music will continue from `input_audio`. Otherwise, generated music will mimic `input_audio`'s melody.",
					default: false,
				},
				{
					name: "continuation_start",
					type: "number",
					description: "Start time of the audio file to use for continuation.",
					default: 0,
				},
				{
					name: "continuation_end",
					type: "number",
					description:
						"End time of the audio file to use for continuation. If -1 or None, will default to the end of the audio clip.",
				},
				{
					name: "multi_band_diffusion",
					type: "boolean",
					description:
						"If `True`, the EnCodec tokens will be decoded with MultiBand Diffusion. Only works with non-stereo models.",
					default: false,
				},
				{
					name: "normalization_strategy",
					type: "string",
					description: "Strategy for normalizing audio.",
					default: "loudness",
					enum: ["loudness", "clip", "peak", "rms"],
				},
				{
					name: "classifier_free_guidance",
					type: "number",
					description:
						"Increases the influence of inputs on the output. Higher values produce lower-varience outputs that adhere more closely to inputs.",
					default: 3,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
			],
		},
	}),
	createModelConfig("replicate-whisper-diarization", PROVIDER, {
		name: "Whisper Diarization",
		matchingModel:
			"cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f",
		description:
			"Blazing fast audio transcription with speaker diarization | Whisper Large V3 Turbo | word & sentence level timestamps | prompt ",
		type: ["audio-to-text"],
		strengths: ["ocr", "audio", "analysis"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.0058,
		replicateInputSchema: {
			reference: "https://replicate.com/thomasmol/whisper-diarization",
			fields: [
				{
					name: "file_string",
					type: ["string"],
					description: "Either provide: Base64 encoded audio file",
					required: false,
				},
				{
					name: "file_string",
					type: ["string"],
					description: "Or provide: A direct audio file URL",
					required: false,
				},
				{
					name: "file",
					type: ["file", "string"],
					description: "Or an audio file",
					required: false,
				},
				{
					name: "prompt",
					type: "string",
					description: "Natural language description of the desired music.",
					required: true,
				},
				{
					name: "num_speakers",
					type: "integer",
					description:
						"Number of distinct speakers expected in the transcription output.",
					default: 2,
				},
				{
					name: "language",
					type: "string",
					description: "Language spoken in the audio clip (ISO 639-1 code).",
					default: "en",
				},
				{
					name: "translate",
					type: "boolean",
					description: "Translate the audio into English during transcription.",
					default: false,
				},
				{
					name: "group_segments",
					type: "boolean",
					description: "Group short segments together for readability.",
					default: true,
				},
			],
		},
	}),
	createModelConfig("replicate-flux-1.1-pro", PROVIDER, {
		name: "FLUX 1.1 Pro",
		matchingModel: "black-forest-labs/flux-1.1-pro",
		description:
			"Black Forest Labs' flagship text-to-image model with excellent quality, prompt adherence, and 6x faster generation.",
		type: ["text-to-image"],
		strengths: ["creative", "image_generation"],
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
		type: ["text-to-image", "image-to-image"],
		strengths: ["creative", "image_generation"],
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
		type: ["image-to-image"],
		strengths: ["image_generation", "analysis"],
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
		type: ["image-to-image"],
		strengths: ["image_generation", "analysis"],
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
	createModelConfig("replicate-whisperx", PROVIDER, {
		name: "WhisperX",
		matchingModel:
			"826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9",
		description:
			"Fast speech transcription with word-level timestamps and speaker diarization using Whisper large-v3.",
		type: ["audio-to-text"],
		strengths: ["ocr", "audio", "analysis"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.026,
		modalities: {
			input: ["audio"],
			output: ["text"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/victor-upmeet/whisperx",
			fields: [
				{
					name: "audio_file",
					type: ["file", "string"],
					description: "Audio file to transcribe.",
					required: true,
				},
				{
					name: "language",
					type: "string",
					description: "Language code (auto-detect if not specified).",
				},
				{
					name: "language_detection_min_prob",
					type: "integer",
					description:
						"If language is not specified, then the language will be detected recursively on different parts of the file until it reaches the given probability",
					default: 0,
				},
				{
					name: "language_detection_max_tries",
					type: "integer",
					description:
						"If language is not specified, then the language will be detected following the logic of language_detection_min_prob parameter, but will stop after the given max retries. If max retries is reached, the most probable language is kept.",
					default: 5,
				},
				{
					name: "initial_prompt",
					type: "string",
					description:
						"Optional text to provide as a prompt for the first window",
				},
				{
					name: "batch_size",
					type: "integer",
					description: "Batch size for transcription (1-64).",
					default: 64,
				},
				{
					name: "temperature",
					type: "integer",
					description: "Temperature to use for sampling",
					default: 0,
				},
				{
					name: "vad_onset",
					type: "integer",
					description: "VAD onset",
					default: 0.5,
				},
				{
					name: "vad_offset",
					type: "integer",
					description: "VAD offset",
					default: 0.383,
				},
				{
					name: "align_output",
					type: "boolean",
					description: "Enable word-level timestamp alignment.",
					default: true,
				},
				{
					name: "diarization",
					type: "boolean",
					description: "Assign speaker ID labels",
					default: false,
				},
				{
					name: "min_speakers",
					type: "integer",
					description: "Minimum number of speakers.",
				},
				{
					name: "max_speakers",
					type: "integer",
					description: "Maximum number of speakers.",
				},
			],
		},
	}),
	createModelConfig("replicate-stable-audio", PROVIDER, {
		name: "Stable Audio 2.5",
		matchingModel: "stability-ai/stable-audio-2.5",
		description:
			"Stability AI's text-to-audio model for generating high-quality music and sound effects.",
		type: ["text-to-audio"],
		strengths: ["creative", "audio", "text-to-audio"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.2,
		modalities: {
			input: ["text"],
			output: ["audio"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/stability-ai/stable-audio-2.5",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Description of the audio to generate.",
					required: true,
				},
				{
					name: "duration",
					type: "number",
					description: "Duration in seconds (1-190).",
					default: 90,
				},
				{
					name: "steps",
					type: "integer",
					description:
						"Number of diffusion steps (higher = better quality but slower) (4-8).",
					default: 8,
				},
				{
					name: "cfg_scale",
					type: "number",
					description:
						"Classifier-free guidance scale (higher = more prompt adherence) (1-25).",
					default: 1,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed.",
				},
			],
		},
	}),
	createModelConfig("replicate-sora-2", PROVIDER, {
		name: "Sora 2",
		matchingModel: "openai/sora-2",
		description: "OpenAI's Flagship video generation with synced audio ",
		type: ["text-to-video"],
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
		type: ["text-to-video"],
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
		type: ["text-to-video"],
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
]);
