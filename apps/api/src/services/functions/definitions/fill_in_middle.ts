import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const fill_in_middle_completion: FunctionToolDescriptor = {
  name: "fill_in_middle_completion",
  description:
    "Generate a fill-in-the-middle completion for code or text by providing the prefix (prompt) and optional suffix. Works across all FIM-capable models.",
  type: "premium",
  costPerCall: 0,
  permissions: ["network"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Required prefix content that appears before the cursor or gap you want to fill.",
      },
      suffix: {
        type: "string",
        description: "Optional suffix content that appears after the cursor or gap.",
      },
      model: (() => {
        return {
          type: "string",
          description:
            "Optional FIM-capable model identifier (defaults to the top recommended model).",
        };
      })(),
      max_tokens: {
        type: "number",
        description: "Maximum number of tokens to generate for the completion.",
        minimum: 1,
      },
      min_tokens: {
        type: "number",
        description: "Minimum number of tokens to generate for the completion.",
        minimum: 0,
      },
      temperature: {
        type: "number",
        description: "Sampling temperature between 0 and 2 (higher is spicier). Accepts decimals.",
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      top_p: {
        type: "number",
        description:
          "Top-p nucleus sampling value between 0 and 1 (lower = more focused). Accepts decimals.",
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      stop: {
        type: "string",
        description: "Comma-separated list of stop sequences that will terminate generation.",
      },
    },
    required: ["prompt"],
  }),
};
