import { MEMORY_SEARCH_TOOL_NAME, MEMORY_STORE_TOOL_NAME } from "~/lib/chat/policy/memory";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const search_memories: FunctionToolDescriptor = {
  name: MEMORY_SEARCH_TOOL_NAME,
  maxIdenticalCalls: 1,
  description:
    "Searches long-term memory in the current personal or workspace-project scope. Use when durable context would improve the answer and memory is enabled.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The specific memory search query.",
      },
      top_k: {
        type: "integer",
        description: "The maximum number of memories to return.",
        minimum: 1,
        maximum: 10,
      },
    },
    required: ["query"],
  }),
  type: "premium",
  permissions: ["read"],
};

export const store_memory: FunctionToolDescriptor = {
  name: MEMORY_STORE_TOOL_NAME,
  description:
    "Stores concise, durable context in the current personal or workspace-project scope. Use only for stable facts, preferences, schedules, or important context that should be remembered in future conversations.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "A concise memory to store.",
      },
      category: {
        type: "string",
        description: "Optional memory category such as preference, fact, schedule, or general.",
      },
    },
    required: ["text"],
  }),
  type: "premium",
  permissions: ["write"],
};
