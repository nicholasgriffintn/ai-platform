import { jsonSchemaToZod } from "../../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "../types";

export const get_recipe: FunctionToolDescriptor = {
  name: "get_recipe",
  description:
    "Get the active recipe setup contract, including exact configuration field keys, saved configuration, trigger types, and enabled tools. Use this before configure_recipe when setting up or correcting a recipe.",
  type: "premium",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      recipeId: {
        type: "string",
        description:
          "Optional recipe id. Defaults to the active recipe setup chat and must match it when provided.",
      },
    },
  }),
};
