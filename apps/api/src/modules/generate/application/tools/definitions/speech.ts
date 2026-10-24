import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "~/types/functions";

let cachedInputSchema: ReturnType<typeof jsonSchemaToZod> | undefined;

export const create_speech: FunctionToolDescriptor = {
  name: "create_speech",
  description:
    "Converts text to spoken audio in the best voice the account can reach. Use when users need audio narration, pronunciation guidance, or accessibility options.",
  get inputSchema() {
    cachedInputSchema ??= jsonSchemaToZod({
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
      },
      required: ["prompt"],
    });

    return cachedInputSchema;
  },
  type: "byok",
  permissions: ["network"],
  effects: { effectClass: "draft" },
};
