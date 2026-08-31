import { jsonSchemaToZod } from "../../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "../types";

export const trigger_recipe: FunctionToolDescriptor = {
  name: "trigger_recipe",
  description:
    "Trigger an installed recipe when the user's message asks to run a recipe or automation. Prefer query for natural language requests; use recipeId only when the exact installed recipe id is known.",
  type: "premium",
  costPerCall: 0,
  permissions: ["read", "write"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      recipeId: {
        type: "string",
        description: "Optional exact installed recipe id to trigger.",
      },
      query: {
        type: "string",
        description:
          "Natural language recipe name or request, for example 'run my bad weather alert'.",
      },
      input: {
        type: "string",
        description: "Optional user instruction or trigger context for the recipe.",
      },
    },
    anyOf: [{ required: ["recipeId"] }, { required: ["query"] }],
    additionalProperties: false,
  }),
};
