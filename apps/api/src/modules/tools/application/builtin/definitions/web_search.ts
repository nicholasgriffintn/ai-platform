import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "~/types/functions";

export const web_search: FunctionToolDescriptor = {
  name: "web_search",
  description:
    "Searches the web for current information: news, facts, prices or anything after your knowledge cutoff.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query.",
      },
      search_depth: {
        type: "string",
        enum: ["basic", "advanced"],
        description: "Use advanced only when basic results are too thin.",
        default: "basic",
      },
    },
    required: ["query"],
    additionalProperties: false,
  }),
};
