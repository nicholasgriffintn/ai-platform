import {
  type SpeechGenerationParams,
  type SpeechResponse,
  generateSpeech,
} from "~/services/apps/generate/speech";
import type { IFunction, IRequest } from "~/types";

export const create_speech: IFunction = {
  name: "create_speech",
  description:
    "Converts text to spoken audio with customizable voice characteristics. Use when users need audio narration, pronunciation guidance, or accessibility options.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "the exact prompt passed in",
      },
      lang: {
        type: "string",
        description:
          "The language code for the speech (e.g., 'en-US', 'fr-FR', 'ja-JP')",
        default: "en-US",
      },
    },
    required: ["prompt"],
  },
  type: "premium",
  costPerCall: 1,
  function: async (
    completion_id: string,
    args: SpeechGenerationParams,
    req: IRequest,
    app_url?: string,
  ): Promise<SpeechResponse> => {
    const response = await generateSpeech({
      completion_id,
      app_url,
      env: req.env,
      args,
      user: req.user,
    });

    return response;
  },
};
