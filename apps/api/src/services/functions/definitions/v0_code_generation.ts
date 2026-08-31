import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const v0_code_generation: FunctionToolDescriptor = {
  name: "v0_code_generation",
  description:
    "Generate code for a web application using the v0 AI model, which is specifically designed for creating frontend and fullstack apps using frameworks like Next.JS.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A prompt describing what code you want to generate.",
      },
      system_prompt: {
        type: "string",
        description: "A system prompt to guide the AI's behavior.",
      },
      image_base_64: {
        type: "string",
        description: "An image to include in the prompt for a multimodal input.",
      },
    },
    required: ["prompt"],
  }),
  type: "byok",
  costPerCall: 0,
  permissions: ["network"],
};
