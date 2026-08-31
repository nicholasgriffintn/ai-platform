import { replicateModelConfig } from "~/data-model/models/replicate";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import { getModelIdsByOutput } from "~/utils/models";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const DEFAULT_DURATION = 8;
export const MUSIC_PROVIDERS = ["workers-ai", "replicate", "elevenlabs"] as const;
export const MUSIC_MODELS = [
  ...getModelIdsByOutput(workersAiModelConfig, "workers-ai", "audio"),
  ...getModelIdsByOutput(replicateModelConfig, "replicate", "audio"),
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
        description: `The duration of the generated music in seconds. Defaults to ${DEFAULT_DURATION} seconds.`,
        default: DEFAULT_DURATION,
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
  costPerCall: 1,
  permissions: ["network"],
};
