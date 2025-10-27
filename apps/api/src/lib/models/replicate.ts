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
  createModelConfig("replicate-zeroscope-v2-xl", PROVIDER, {
    name: "Zeroscope V2 XL",
    matchingModel:
      "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
    description:
      "Zeroscope V2 XL for text-to-video synthesis capable of generating short cinematic clips from prompts.",
    type: ["text-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: false,
    costPerRun: 0.06,
    replicateInputSchema: {
      reference: "https://replicate.com/anotherjesse/zeroscope-v2-xl",
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
            "Elements or styles that should be removed from the generation.",
          default: "",
        },
        {
          name: "duration",
          type: "number",
          description: "Clip length in seconds.",
          default: 8,
        },
        {
          name: "width",
          type: "integer",
          description: "Frame width in pixels.",
          default: 576,
        },
        {
          name: "height",
          type: "integer",
          description: "Frame height in pixels.",
          default: 320,
        },
      ],
    },
  }),
  createModelConfig("replicate-zeroscope-v2-xl-latest", PROVIDER, {
    name: "Zeroscope V2 XL (Latest Version)",
    matchingModel:
      "847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405",
    description:
      "Updated release of Zeroscope V2 XL offering improved temporal consistency and camera motion controls.",
    type: ["text-to-video"],
    strengths: ["creative", "video_generation"],
    supportsStreaming: false,
    supportsAttachments: false,
    costPerRun: 0.06,
    replicateInputSchema: {
      reference: "https://replicate.com/anotherjesse/zeroscope-v2-xl",
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
            "Elements or styles that should be removed from the generation.",
          default: "",
        },
        {
          name: "duration",
          type: "number",
          description: "Clip length in seconds.",
          default: 8,
        },
        {
          name: "width",
          type: "integer",
          description: "Frame width in pixels.",
          default: 576,
        },
        {
          name: "height",
          type: "integer",
          description: "Frame height in pixels.",
          default: 320,
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
          default: "melody",
          enum: ["melody", "medium", "small", "large"],
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
      ],
    },
  }),
  createModelConfig("replicate-whisper-large-v3", PROVIDER, {
    name: "Whisper Large V3",
    matchingModel:
      "cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f",
    description:
      "OpenAI Whisper Large V3 deployed on Replicate for high quality multilingual speech-to-text transcription.",
    type: ["audio-to-text"],
    strengths: ["ocr", "audio", "analysis"],
    supportsStreaming: false,
    supportsAttachments: true,
    costPerRun: 0.18,
    replicateInputSchema: {
      reference: "https://replicate.com/openai/whisper-large-v3",
      fields: [
        {
          name: "file",
          type: ["file", "string"],
          description: "Audio file URL or handle to transcribe.",
          required: true,
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
          name: "transcript_output_format",
          type: "string",
          description:
            "Preferred output format (segments_only, verbose_json, text).",
          default: "segments_only",
          enum: ["segments_only", "verbose_json", "text"],
        },
        {
          name: "group_segments",
          type: "boolean",
          description: "Group short segments together for readability.",
          default: true,
        },
        {
          name: "offset_seconds",
          type: "number",
          description:
            "Skip transcription for the first N seconds of the clip.",
          default: 0,
        },
      ],
    },
  }),
]);
