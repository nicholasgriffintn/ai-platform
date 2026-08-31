import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const next_edit_completion: FunctionToolDescriptor = {
  name: "next_edit_completion",
  description:
    "Request the next code edit suggestion from Mercury Coder using contextual project snippets.",
  type: "premium",
  costPerCall: 0,
  permissions: ["network"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Structured prompt containing the current file state, edit history, and target region.",
      },
      model: {
        type: "string",
        description: "Optional Mercury model to use for the edit (defaults to the best available).",
      },
    },
    required: ["prompt"],
  }),
};
