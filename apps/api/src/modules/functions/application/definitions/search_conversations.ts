import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "./types";

export const SEARCH_CONVERSATIONS_TOOL_NAME = "search_conversations";

export const search_conversations: FunctionToolDescriptor = {
  name: SEARCH_CONVERSATIONS_TOOL_NAME,
  maxIdenticalCalls: 1,
  description:
    "Searches the user's earlier conversations in the current personal or project scope and returns matching excerpts with conversation titles and dates. Use when the user refers to something discussed before, such as 'the trip we planned' or 'that bug from last week'. Search with distinctive keywords, not a full sentence.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Distinctive keywords to look for in earlier messages.",
      },
      limit: {
        type: "integer",
        description: "The maximum number of conversations to return.",
        minimum: 1,
        maximum: 8,
      },
    },
    required: ["query"],
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};
