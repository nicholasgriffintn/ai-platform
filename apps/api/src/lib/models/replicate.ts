import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "./utils";

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
    costPerRun: 0.003,
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
    costPerRun: 0.06,
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
          name: "fps",
          type: "number",
          description: "Frames per second of the output video",
          default: 24,
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
    costPerRun: 0.1,
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
    costPerRun: 0.18,
    replicateInputSchema: {
      reference: "https://replicate.com/thomasmol/whisper-diarization",
      fields: [
        {
          name: "file",
          type: ["file", "string"],
          description: "Audio file URL or handle to transcribe.",
          required: true,
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
    matchingModel:
      "a91bed9b0301d9d10b34b89b1f4d0255f2e2499c59576bfcd13405575dacdb25",
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
          required: true,
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
      ],
    },
  }),
  createModelConfig("replicate-sdxl", PROVIDER, {
    name: "Stable Diffusion XL",
    matchingModel:
      "46ad775d45e4c606eb4a8f022a40e9e3d0a22993815d798bcd2103c0e72427bd",
    description: "Stability AI's SDXL with inpainting and img2img support.",
    type: ["text-to-image", "image-to-image"],
    strengths: ["creative", "image_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.0049,
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
          name: "image",
          type: ["file", "string"],
          description: "Input image for img2img or inpaint.",
        },
        {
          name: "mask",
          type: ["file", "string"],
          description: "Mask for inpainting.",
        },
        {
          name: "width",
          type: "integer",
          description: "Output width.",
          default: 1024,
        },
        {
          name: "height",
          type: "integer",
          description: "Output height.",
          default: 1024,
        },
        {
          name: "num_outputs",
          type: "integer",
          description: "Number of images (1-4).",
          default: 1,
        },
        {
          name: "scheduler",
          type: "string",
          description: "Diffusion scheduler.",
          default: "K_EULER",
          enum: [
            "DDIM",
            "DPMSolverMultistep",
            "HeunDiscrete",
            "KarrasDPM",
            "K_EULER_ANCESTRAL",
            "K_EULER",
            "PNDM",
          ],
        },
        {
          name: "num_inference_steps",
          type: "integer",
          description: "Denoising steps (1-50).",
          default: 50,
        },
        {
          name: "guidance_scale",
          type: "number",
          description: "Prompt adherence scale.",
          default: 7.5,
        },
        {
          name: "prompt_strength",
          type: "number",
          description: "Prompt strength for img2img (0-1).",
          default: 0.8,
        },
        {
          name: "refine",
          type: "string",
          description: "Refiner model.",
          default: "no_refiner",
          enum: ["no_refiner", "expert_ensemble_refiner", "base_image_refiner"],
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
    matchingModel:
      "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
    description: "Practical image upscaling with super-resolution enhancement.",
    type: ["image-to-image"],
    strengths: ["image_generation", "analysis"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.005,
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
          description: "Run face enhancement.",
          default: false,
        },
      ],
    },
  }),
  createModelConfig("replicate-rembg", PROVIDER, {
    name: "Remove Background",
    matchingModel:
      "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
    description:
      "Remove backgrounds from images automatically using AI segmentation.",
    type: ["image-to-image"],
    strengths: ["image_generation", "analysis"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.001,
    modalities: {
      input: ["image"],
      output: ["image"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/cjwbw/rembg",
      fields: [
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image for background removal.",
          required: true,
        },
        {
          name: "model",
          type: "string",
          description: "Background removal model.",
          default: "u2net",
          enum: ["u2net", "u2netp", "u2net_human_seg", "silueta"],
        },
        {
          name: "alpha_matting",
          type: "boolean",
          description: "Use alpha matting for better edges.",
          default: false,
        },
        {
          name: "alpha_matting_foreground_threshold",
          type: "integer",
          description: "Foreground threshold (0-255).",
          default: 240,
        },
        {
          name: "alpha_matting_background_threshold",
          type: "integer",
          description: "Background threshold (0-255).",
          default: 10,
        },
      ],
    },
  }),
  createModelConfig("replicate-llava-v1.6-34b", PROVIDER, {
    name: "LLaVA 1.6 34B",
    matchingModel:
      "41ecfbfb261e6c1adf3ad896c9066ca98346996d7c4045c5bc944a79d430f174",
    description:
      "Powerful vision-language model for image understanding and captioning.",
    type: ["image-to-text"],
    strengths: ["analysis", "ocr", "reasoning"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.01,
    modalities: {
      input: ["image", "text"],
      output: ["text"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/yorickvp/llava-v1.6-34b",
      fields: [
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image to analyze.",
          required: true,
        },
        {
          name: "prompt",
          type: "string",
          description: "Question or instruction about the image.",
          required: true,
        },
        {
          name: "max_tokens",
          type: "integer",
          description: "Maximum tokens to generate.",
          default: 1024,
        },
        {
          name: "temperature",
          type: "number",
          description: "Sampling temperature (0-1).",
          default: 0.2,
        },
        {
          name: "top_p",
          type: "number",
          description: "Nucleus sampling threshold.",
          default: 1.0,
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
    costPerRun: 0.022,
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
          name: "batch_size",
          type: "integer",
          description: "Batch size for transcription (1-64).",
          default: 16,
        },
        {
          name: "align_output",
          type: "boolean",
          description: "Enable word-level timestamp alignment.",
          default: true,
        },
        {
          name: "diarize",
          type: "boolean",
          description: "Enable speaker diarization.",
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
    costPerRun: 0.15,
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
          name: "negative_prompt",
          type: "string",
          description: "What to avoid in generation.",
          default: "",
        },
        {
          name: "duration",
          type: "number",
          description: "Duration in seconds (1-180).",
          default: 30,
        },
        {
          name: "steps",
          type: "integer",
          description: "Number of diffusion steps (10-200).",
          default: 100,
        },
        {
          name: "cfg_scale",
          type: "number",
          description: "Classifier-free guidance scale (1-15).",
          default: 7,
        },
        {
          name: "seed",
          type: "integer",
          description: "Random seed.",
        },
      ],
    },
  }),
  createModelConfig("replicate-sam-2", PROVIDER, {
    name: "SAM 2",
    matchingModel: "meta/sam-2-video",
    description:
      "Meta's Segment Anything Model 2 for object segmentation in images and videos.",
    type: ["image-to-image", "video-to-video"],
    strengths: ["analysis", "image_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.03,
    modalities: {
      input: ["image", "video"],
      output: ["image", "video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/meta/sam-2-video",
      fields: [
        {
          name: "video",
          type: ["file", "string"],
          description: "Input video for segmentation.",
          required: true,
        },
        {
          name: "points",
          type: "string",
          description: "JSON array of point coordinates for segmentation.",
        },
        {
          name: "labels",
          type: "string",
          description: "JSON array of labels (1=foreground, 0=background).",
        },
        {
          name: "box",
          type: "string",
          description: "Bounding box as [x1,y1,x2,y2].",
        },
        {
          name: "multimask_output",
          type: "boolean",
          description: "Output multiple masks.",
          default: false,
        },
      ],
    },
  }),
  createModelConfig("replicate-qwen-image-edit", PROVIDER, {
    name: "Qwen Image Edit",
    matchingModel: "qwen/qwen-image-edit",
    description:
      "Qwen's image editing model with multi-image support and ControlNet integration.",
    type: ["image-to-image", "text-to-image"],
    strengths: ["creative", "image_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.02,
    modalities: {
      input: ["text", "image"],
      output: ["image"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/qwen/qwen-image-edit",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Editing instruction.",
          required: true,
        },
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image to edit.",
          required: true,
        },
        {
          name: "negative_prompt",
          type: "string",
          description: "What to avoid.",
          default: "",
        },
        {
          name: "num_inference_steps",
          type: "integer",
          description: "Number of steps (1-100).",
          default: 50,
        },
        {
          name: "guidance_scale",
          type: "number",
          description: "Guidance scale (1-20).",
          default: 7.5,
        },
        {
          name: "seed",
          type: "integer",
          description: "Random seed.",
        },
      ],
    },
  }),
  createModelConfig("replicate-incredibly-fast-whisper", PROVIDER, {
    name: "Incredibly Fast Whisper",
    matchingModel:
      "3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
    description:
      "Optimized Whisper implementation for ultra-fast speech transcription.",
    type: ["audio-to-text"],
    strengths: ["ocr", "audio", "analysis"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.001,
    modalities: {
      input: ["audio"],
      output: ["text"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/vaibhavs10/incredibly-fast-whisper",
      fields: [
        {
          name: "audio",
          type: ["file", "string"],
          description: "Audio file to transcribe.",
          required: true,
        },
        {
          name: "task",
          type: "string",
          description: "Task type.",
          default: "transcribe",
          enum: ["transcribe", "translate"],
        },
        {
          name: "language",
          type: "string",
          description: "Language of the audio.",
          default: "None",
        },
        {
          name: "timestamp",
          type: "string",
          description: "Timestamp granularity.",
          default: "chunk",
          enum: ["chunk", "word"],
        },
        {
          name: "batch_size",
          type: "integer",
          description: "Batch size (1-64).",
          default: 24,
        },
      ],
    },
  }),
  createModelConfig("replicate-seedream-4", PROVIDER, {
    name: "Seedream 4",
    matchingModel:
      "e6cff243d7a5e551e1ca2b4bf291413d649c9f1417f9a52c1c0a4fbc36027b83",
    description:
      "ByteDance's unified text-to-image generation and editing model supporting up to 4K resolution.",
    type: ["text-to-image", "image-to-image"],
    strengths: ["creative", "image_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.025,
    modalities: {
      input: ["text", "image"],
      output: ["image"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/bytedance/seedream-4",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Text prompt or editing instruction.",
          required: true,
        },
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image for editing mode.",
        },
        {
          name: "negative_prompt",
          type: "string",
          description: "Negative prompt.",
          default: "",
        },
        {
          name: "width",
          type: "integer",
          description: "Output width (512-4096).",
          default: 1024,
        },
        {
          name: "height",
          type: "integer",
          description: "Output height (512-4096).",
          default: 1024,
        },
        {
          name: "num_outputs",
          type: "integer",
          description: "Number of images (1-4).",
          default: 1,
        },
        {
          name: "guidance_scale",
          type: "number",
          description: "Guidance scale (1-20).",
          default: 7.5,
        },
        {
          name: "num_inference_steps",
          type: "integer",
          description: "Inference steps (1-100).",
          default: 50,
        },
        {
          name: "seed",
          type: "integer",
          description: "Random seed.",
        },
      ],
    },
  }),
  createModelConfig("replicate-seedance-1-pro-fast", PROVIDER, {
    name: "Seedance 1 Pro Fast",
    matchingModel: "bytedance/seedance-1-pro-fast",
    description:
      "Faster and cheaper version of Seedance 1 Pro for quick video generation.",
    type: ["text-to-video", "image-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.08,
    modalities: {
      input: ["text", "image"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/bytedance/seedance-1-pro-fast",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image for image-to-video.",
        },
        {
          name: "duration",
          type: "string",
          description: "Video duration.",
          default: "5s",
          enum: ["5s", "10s"],
        },
        {
          name: "resolution",
          type: "string",
          description: "Video resolution.",
          default: "720p",
          enum: ["480p", "720p", "1080p"],
        },
        {
          name: "seed",
          type: "integer",
          description: "Random seed.",
        },
      ],
    },
  }),
  createModelConfig("replicate-seedance-1-pro", PROVIDER, {
    name: "Seedance 1 Pro",
    matchingModel: "bytedance/seedance-1-pro",
    description:
      "Pro version of Seedance with text-to-video and image-to-video support for 5s or 10s videos at 480p and 1080p.",
    type: ["text-to-video", "image-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.15,
    modalities: {
      input: ["text", "image"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/bytedance/seedance-1-pro",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image for image-to-video.",
        },
        {
          name: "duration",
          type: "string",
          description: "Video duration.",
          default: "5s",
          enum: ["5s", "10s"],
        },
        {
          name: "resolution",
          type: "string",
          description: "Video resolution.",
          default: "1080p",
          enum: ["480p", "1080p"],
        },
        {
          name: "seed",
          type: "integer",
          description: "Random seed.",
        },
      ],
    },
  }),
  createModelConfig("replicate-veo-3-fast", PROVIDER, {
    name: "Veo 3 Fast",
    matchingModel: "google/veo-3-fast",
    description:
      "Google's fast video generation model with high-fidelity output.",
    type: ["text-to-video", "image-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.12,
    modalities: {
      input: ["text", "image"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/google/veo-3-fast",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video description.",
          required: true,
        },
        {
          name: "image",
          type: ["file", "string"],
          description: "Reference image.",
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds (1-8).",
          default: 5,
        },
        {
          name: "aspect_ratio",
          type: "string",
          description: "Aspect ratio.",
          default: "16:9",
          enum: ["16:9", "9:16", "1:1"],
        },
      ],
    },
  }),
  createModelConfig("replicate-nano-banana", PROVIDER, {
    name: "Nano Banana",
    matchingModel: "google/nano-banana",
    description: "Google's latest image editing model in Gemini 2.5.",
    type: ["image-to-image"],
    strengths: ["creative", "image_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.01,
    modalities: {
      input: ["text", "image"],
      output: ["image"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/google/nano-banana",
      fields: [
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image to edit.",
          required: true,
        },
        {
          name: "prompt",
          type: "string",
          description: "Editing instruction.",
          required: true,
        },
        {
          name: "guidance_scale",
          type: "number",
          description: "Guidance scale (1-20).",
          default: 7.5,
        },
      ],
    },
  }),
  createModelConfig("replicate-sora-2", PROVIDER, {
    name: "Sora 2",
    matchingModel: "openai/sora-2",
    description: "OpenAI's flagship video generation with synced audio.",
    type: ["text-to-video"],
    strengths: ["creative", "video_generation"],
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
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds (1-20).",
          default: 5,
        },
        {
          name: "resolution",
          type: "string",
          description: "Video resolution.",
          default: "1080p",
          enum: ["720p", "1080p"],
        },
        {
          name: "aspect_ratio",
          type: "string",
          description: "Aspect ratio.",
          default: "16:9",
          enum: ["16:9", "9:16", "1:1"],
        },
      ],
    },
  }),
  createModelConfig("replicate-sora-2-pro", PROVIDER, {
    name: "Sora 2 Pro",
    matchingModel: "openai/sora-2-pro",
    description:
      "OpenAI's pro-tier Sora with extended duration and higher quality.",
    type: ["text-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: false,
    costPerRun: 1.0,
    modalities: {
      input: ["text"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/openai/sora-2-pro",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds (1-60).",
          default: 10,
        },
        {
          name: "resolution",
          type: "string",
          description: "Video resolution.",
          default: "1080p",
          enum: ["1080p", "4K"],
        },
        {
          name: "aspect_ratio",
          type: "string",
          description: "Aspect ratio.",
          default: "16:9",
          enum: ["16:9", "9:16", "1:1", "21:9"],
        },
      ],
    },
  }),
  createModelConfig("replicate-ltx-2-pro", PROVIDER, {
    name: "LTX 2 Pro",
    matchingModel: "lightricks/ltx-2-pro",
    description:
      "Lightricks' pro video model with high visual fidelity for content creation.",
    type: ["text-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: false,
    costPerRun: 0.2,
    modalities: {
      input: ["text"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/lightricks/ltx-2-pro",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds (1-10).",
          default: 5,
        },
        {
          name: "aspect_ratio",
          type: "string",
          description: "Aspect ratio.",
          default: "16:9",
          enum: ["16:9", "9:16", "1:1"],
        },
      ],
    },
  }),
  createModelConfig("replicate-ltx-2-fast", PROVIDER, {
    name: "LTX 2 Fast",
    matchingModel: "lightricks/ltx-2-fast",
    description:
      "Lightricks' fast video model for rapid ideation and mobile workflows.",
    type: ["text-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: false,
    costPerRun: 0.08,
    modalities: {
      input: ["text"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/lightricks/ltx-2-fast",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds (1-5).",
          default: 3,
        },
        {
          name: "aspect_ratio",
          type: "string",
          description: "Aspect ratio.",
          default: "16:9",
          enum: ["16:9", "9:16", "1:1"],
        },
      ],
    },
  }),
  createModelConfig("replicate-omni-human", PROVIDER, {
    name: "Omni Human",
    matchingModel: "bytedance/omni-human",
    description:
      "ByteDance's model that turns audio/video/images into professional animated videos.",
    type: ["image-to-video", "audio-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.25,
    modalities: {
      input: ["image", "audio", "video"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/bytedance/omni-human",
      fields: [
        {
          name: "image",
          type: ["file", "string"],
          description: "Input image of person.",
          required: true,
        },
        {
          name: "audio",
          type: ["file", "string"],
          description: "Audio file for lip sync.",
        },
        {
          name: "video",
          type: ["file", "string"],
          description: "Reference video for motion.",
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds.",
          default: 5,
        },
      ],
    },
  }),
  createModelConfig("replicate-luma-ray", PROVIDER, {
    name: "Luma Ray",
    matchingModel: "luma/ray",
    description: "Luma's high-quality video generation model.",
    type: ["text-to-video", "image-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.3,
    modalities: {
      input: ["text", "image"],
      output: ["video"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/luma/ray",
      fields: [
        {
          name: "prompt",
          type: "string",
          description: "Video generation prompt.",
          required: true,
        },
        {
          name: "image",
          type: ["file", "string"],
          description: "Starting frame image.",
        },
        {
          name: "duration",
          type: "integer",
          description: "Duration in seconds (1-10).",
          default: 5,
        },
        {
          name: "aspect_ratio",
          type: "string",
          description: "Aspect ratio.",
          default: "16:9",
          enum: ["16:9", "9:16", "1:1"],
        },
      ],
    },
  }),
  createModelConfig("replicate-dolphin", PROVIDER, {
    name: "Dolphin",
    matchingModel: "bytedance/dolphin",
    description:
      "ByteDance's OCR model for document understanding and text extraction.",
    type: ["image-to-text", "ocr"],
    strengths: ["ocr", "analysis"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.015,
    modalities: {
      input: ["image", "document"],
      output: ["text"],
    },
    replicateInputSchema: {
      reference: "https://replicate.com/bytedance/dolphin",
      fields: [
        {
          name: "image",
          type: ["file", "string"],
          description: "Image or document to process.",
          required: true,
        },
        {
          name: "task",
          type: "string",
          description: "OCR task type.",
          default: "ocr",
          enum: ["ocr", "table", "formula"],
        },
        {
          name: "language",
          type: "string",
          description: "Language code.",
          default: "en",
        },
      ],
    },
  }),
]);
