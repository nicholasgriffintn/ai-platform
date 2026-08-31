import { replicateModelConfig } from "~/data-model/models/replicate";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import { getModelIdsByOutput } from "~/utils/models";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const DEFAULT_HEIGHT = 320;
export const DEFAULT_WIDTH = 576;
export const MAX_DIMENSION = 1280;
export const DEFAULT_FRAMES = 24;
export const DEFAULT_GUIDANCE_SCALE = 6;
export const MIN_GUIDANCE_SCALE = 1;
export const DEFAULT_INFER_STEPS = 50;
export const MIN_INFER_STEPS = 1;
export const DEFAULT_FLOW_SHIFT = 7;
export const VIDEO_PROVIDERS = ["workers-ai", "replicate"] as const;
export const VIDEO_MODELS = [
  ...getModelIdsByOutput(workersAiModelConfig, "workers-ai", "video"),
  ...getModelIdsByOutput(replicateModelConfig, "replicate", "video"),
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
        description: `Scale for classifier-free guidance. Must be greater than or equal to ${MIN_GUIDANCE_SCALE} and no greater than ${DEFAULT_GUIDANCE_SCALE} Defaults to ${DEFAULT_GUIDANCE_SCALE}.`,
        default: DEFAULT_GUIDANCE_SCALE,
        minimum: MIN_GUIDANCE_SCALE,
      },
      video_length: {
        type: "integer",
        description: `The length of the video in frames. Defaults to ${DEFAULT_FRAMES}.`,
        default: DEFAULT_FRAMES,
      },
      infer_steps: {
        type: "integer",
        description: `The number of inference steps to take. Must be greater than or equal to ${MIN_INFER_STEPS}. Defaults to ${DEFAULT_INFER_STEPS}.`,
        default: DEFAULT_INFER_STEPS,
      },
      seed: {
        type: "integer",
        description: "A random seed for reproducibility.",
      },
      flow_shift: {
        type: "integer",
        description: `The amount of flow shift to apply. Defaults to ${DEFAULT_FLOW_SHIFT}.`,
        default: DEFAULT_FLOW_SHIFT,
      },
      height: {
        type: "integer",
        description: `The height of the video. Defaults to ${DEFAULT_HEIGHT}, must be less than or equal to ${MAX_DIMENSION}.`,
        default: DEFAULT_HEIGHT,
        maximum: MAX_DIMENSION,
      },
      width: {
        type: "integer",
        description: `The width of the video. Defaults to ${DEFAULT_WIDTH}, must be less than or equal to ${MAX_DIMENSION}.`,
        default: DEFAULT_WIDTH,
        maximum: MAX_DIMENSION,
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
  costPerCall: 2,
  permissions: ["network"],
};
