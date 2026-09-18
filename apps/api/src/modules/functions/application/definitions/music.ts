import { getModelIdsByOutput, getProviderModels } from "@ngriffin_uk/polychat-ai-models";
import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import { MUSIC_DEFAULT_DURATION } from "~/config/limits";
import { MUSIC_PROVIDERS } from "~/config/providers";

import type { FunctionToolDescriptor } from "./types";

export const MUSIC_MODELS = [
  ...getModelIdsByOutput(getProviderModels("workers-ai"), "workers-ai", "audio"),
  ...getModelIdsByOutput(getProviderModels("replicate"), "replicate", "audio"),
].sort();

export const create_music: FunctionToolDescriptor = {
  name: "create_music",
  description:
    "Composes musical pieces based on stylistic and emotional prompts. Use when users request songs, melodies, or audio compositions.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Description of the desired music including style, mood, tempo, and instruments",
      },
      input_audio: {
        type: "string",
        description: "An audio file that will influence the generated music.",
      },
      duration: {
        type: "number",
        description: `The duration of the generated music in seconds. Defaults to ${MUSIC_DEFAULT_DURATION} seconds.`,
        default: MUSIC_DEFAULT_DURATION,
      },
      provider: {
        type: "string",
        description: "Music generation provider",
        enum: Array.from(MUSIC_PROVIDERS),
        default: "replicate",
      },
      model: {
        type: "string",
        description: "Specific music generation model to use",
        enum: MUSIC_MODELS,
      },
    },
    required: ["prompt"],
  }),
  type: "byok",
  permissions: ["network"],
};
