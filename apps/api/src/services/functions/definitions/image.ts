import { replicateModelConfig } from "~/data-model/models/replicate";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import { imagePrompts } from "~/lib/prompts/image";
import { getModelIdsByOutput } from "~/utils/models";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const IMAGE_PROVIDERS = ["workers-ai", "replicate"] as const;
export const IMAGE_MODELS = [
  ...getModelIdsByOutput(replicateModelConfig, "replicate", "image"),
  ...getModelIdsByOutput(workersAiModelConfig, "workers-ai", "image"),
].sort();

export const create_image: FunctionToolDescriptor = {
  name: "create_image",
  description:
    "Generates visual imagery based on detailed text descriptions. Use when users request illustrations, artwork, diagrams, or visual representations.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "the exact prompt passed in",
      },
      image_style: {
        type: "string",
        description: "The style of the image to generate",
        enum: Object.keys(imagePrompts),
      },
      steps: {
        type: "integer",
        description: "The number of diffusion steps to use",
        minimum: 1,
        maximum: 8,
      },
      provider: {
        type: "string",
        description: "Image generation provider",
        enum: Array.from(IMAGE_PROVIDERS),
        default: "workers-ai",
      },
      model: {
        type: "string",
        description: "Specific image generation model to use",
        enum: IMAGE_MODELS,
      },
      aspect_ratio: {
        type: "string",
        description: "Aspect ratio for the generated image",
      },
      width: {
        type: "integer",
        description: "Width of the generated image in pixels",
      },
      height: {
        type: "integer",
        description: "Height of the generated image in pixels",
      },
    },
    required: ["prompt"],
  }),
  type: "byok",
  permissions: ["network"],
};
