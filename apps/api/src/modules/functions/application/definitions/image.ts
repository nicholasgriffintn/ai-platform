import { getModelIdsByOutput, getProviderModels } from "@ngriffin_uk/polychat-ai-models";
import { imagePromptStyles } from "@ngriffin_uk/polychat-ai-prompts";
import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import { IMAGE_PROVIDERS } from "~/config/providers";

import type { FunctionToolDescriptor } from "./types";

export const IMAGE_MODELS = [
  ...getModelIdsByOutput(getProviderModels("replicate"), "replicate", "image"),
  ...getModelIdsByOutput(getProviderModels("workers-ai"), "workers-ai", "image"),
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
        enum: [...imagePromptStyles],
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
