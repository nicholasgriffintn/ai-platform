import { getModelIdsByOutput, getProviderModels } from "@ngriffin_uk/polychat-ai-models";
import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import {
  VIDEO_DEFAULT_FLOW_SHIFT,
  VIDEO_DEFAULT_FRAMES,
  VIDEO_DEFAULT_GUIDANCE_SCALE,
  VIDEO_DEFAULT_HEIGHT,
  VIDEO_DEFAULT_INFER_STEPS,
  VIDEO_DEFAULT_WIDTH,
  VIDEO_MAX_DIMENSION,
  VIDEO_MIN_GUIDANCE_SCALE,
  VIDEO_MIN_INFER_STEPS,
} from "~/config/limits";
import { VIDEO_PROVIDERS } from "~/config/providers";

import type { FunctionToolDescriptor } from "./types";

export const VIDEO_MODELS = [
  ...getModelIdsByOutput(getProviderModels("workers-ai"), "workers-ai", "video"),
  ...getModelIdsByOutput(getProviderModels("replicate"), "replicate", "video"),
].sort();

export const create_video: FunctionToolDescriptor = {
  name: "create_video",
  description:
    "Produces video content from descriptive prompts. Use when users request animations, visual sequences, or dynamic visual content.",
  type: "byok",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "the main prompt that should be passed in to the LLM",
      },
      negative_prompt: {
        type: "string",
        description: "the negative prompt that should be passed in to the LLM",
      },
      embedded_guidance_scale: {
        type: "integer",
        description: `Scale for classifier-free guidance. Must be greater than or equal to ${VIDEO_MIN_GUIDANCE_SCALE} and no greater than ${VIDEO_DEFAULT_GUIDANCE_SCALE} Defaults to ${VIDEO_DEFAULT_GUIDANCE_SCALE}.`,
        default: VIDEO_DEFAULT_GUIDANCE_SCALE,
        minimum: VIDEO_MIN_GUIDANCE_SCALE,
      },
      video_length: {
        type: "integer",
        description: `The length of the video in frames. Defaults to ${VIDEO_DEFAULT_FRAMES}.`,
        default: VIDEO_DEFAULT_FRAMES,
      },
      infer_steps: {
        type: "integer",
        description: `The number of inference steps to take. Must be greater than or equal to ${VIDEO_MIN_INFER_STEPS}. Defaults to ${VIDEO_DEFAULT_INFER_STEPS}.`,
        default: VIDEO_DEFAULT_INFER_STEPS,
      },
      seed: {
        type: "integer",
        description: "A random seed for reproducibility.",
      },
      flow_shift: {
        type: "integer",
        description: `The amount of flow shift to apply. Defaults to ${VIDEO_DEFAULT_FLOW_SHIFT}.`,
        default: VIDEO_DEFAULT_FLOW_SHIFT,
      },
      height: {
        type: "integer",
        description: `The height of the video. Defaults to ${VIDEO_DEFAULT_HEIGHT}, must be less than or equal to ${VIDEO_MAX_DIMENSION}.`,
        default: VIDEO_DEFAULT_HEIGHT,
        maximum: VIDEO_MAX_DIMENSION,
      },
      width: {
        type: "integer",
        description: `The width of the video. Defaults to ${VIDEO_DEFAULT_WIDTH}, must be less than or equal to ${VIDEO_MAX_DIMENSION}.`,
        default: VIDEO_DEFAULT_WIDTH,
        maximum: VIDEO_MAX_DIMENSION,
      },
      provider: {
        type: "string",
        description: "Video generation provider",
        enum: Array.from(VIDEO_PROVIDERS),
        default: "replicate",
      },
      model: {
        type: "string",
        description: "Specific video generation model to use",
        enum: VIDEO_MODELS,
      },
      aspect_ratio: {
        type: "string",
        description: "Aspect ratio for the generated video",
      },
    },
    required: ["prompt"],
  }),
  permissions: ["network"],
};
