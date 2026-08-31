import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const apply_edit_completion: FunctionToolDescriptor = {
  name: "apply_edit_completion",
  description: "Apply a code snippet update using Mercury Coder's apply-edit capability.",
  type: "premium",
  permissions: ["network"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Structured prompt containing the original code block and the update snippet to apply.",
      },
      model: {
        type: "string",
        description:
          "Optional Mercury model to use for applying the edit (defaults to the best available).",
      },
    },
    required: ["prompt"],
  }),
};
