import { replicateModelConfig } from "~/data-model/models/replicate";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import { getModelIdsByOutput } from "~/utils/models";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const SPEECH_PROVIDERS = ["workers-ai", "replicate"] as const;
export const SPEECH_MODELS = [
  ...getModelIdsByOutput(workersAiModelConfig, "workers-ai", "speech"),
  ...getModelIdsByOutput(replicateModelConfig, "replicate", "audio"),
].sort();

export const create_speech: FunctionToolDescriptor = {
  name: "create_speech",
  description:
    "Converts text to spoken audio with customizable voice characteristics. Use when users need audio narration, pronunciation guidance, or accessibility options.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "the exact prompt passed in",
      },
      lang: {
        type: "string",
        description: "The language code for the speech (e.g., 'en-US', 'fr-FR', 'ja-JP')",
        default: "en-US",
      },
      provider: {
        type: "string",
        description: "Speech generation provider",
        enum: Array.from(SPEECH_PROVIDERS),
        default: "workers-ai",
      },
      model: {
        type: "string",
        description: "Specific speech generation model to use",
        enum: SPEECH_MODELS,
      },
      voice: {
        type: "string",
        description: "Voice preset or identifier for speech synthesis",
      },
    },
    required: ["prompt"],
  }),
  type: "byok",
  permissions: ["network"],
};
