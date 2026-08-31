import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const web_search: FunctionToolDescriptor = {
  name: "web_search",
  description:
    "Performs a web search to find current information on any topic. Use for retrieving recent news, facts, or information beyond your knowledge cutoff.",
  type: "normal",
  costPerCall: 1,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to look up",
      },
      search_depth: {
        type: "string",
        enum: ["basic", "advanced"],
        description:
          "The depth of the search - 'basic' for quick results or 'advanced' for more comprehensive results",
        default: "basic",
      },
      include_answer: {
        type: "boolean",
        description: "Whether to include an AI-generated answer in the response",
        default: false,
      },
      include_raw_content: {
        type: "boolean",
        description: "Whether to include the raw content from the search results",
        default: false,
      },
      include_images: {
        type: "boolean",
        description: "Whether to include images in the search results",
        default: false,
      },
    },
    required: ["query"],
    additionalProperties: false,
  }),
};
