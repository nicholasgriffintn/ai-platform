import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const get_note: FunctionToolDescriptor = {
  name: "get_note",
  description:
    "Retrieves previously saved notes based on title, tags, or content search. Use when users reference earlier information, need to continue work on a project, or want to review saved material.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The query to search for",
      },
    },
    required: ["query"],
  }),
  type: "premium",
  costPerCall: 0,
  permissions: ["read"],
};
