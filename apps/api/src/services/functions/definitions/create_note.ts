import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const create_note: FunctionToolDescriptor = {
  name: "create_note",
  description:
    "Stores user information, content, or AI-generated material as a retrievable note. Use when users want to save content for future reference, build a knowledge base, or maintain project information across sessions.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title of the note, this can be a summary of the content",
      },
      content: {
        type: "string",
        description: "The content of the note",
      },
      metadata: {
        type: "object",
        description: "Metadata about the note",
      },
    },
    required: ["title", "content"],
  }),
  type: "premium",
  permissions: ["write"],
};
