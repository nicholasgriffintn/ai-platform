import { jsonSchemaToZod } from "../../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "../types";

export const configure_recipe: FunctionToolDescriptor = {
  name: "configure_recipe",
  description:
    "Save configuration and triggers for the active recipe setup chat after the user confirms the details or asks you to choose sensible defaults. Call get_recipe first if you need the exact configuration field keys.",
  type: "premium",
  costPerCall: 0,
  permissions: ["write"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      recipeId: {
        type: "string",
        description: "Optional active recipe id. Must match the recipe being set up.",
      },
      configuration: {
        type: "object",
        description: "Recipe configuration values to save.",
      },
      triggers: {
        type: "array",
        description:
          "Recipe triggers to save. Include a manual trigger unless the user explicitly disables manual runs.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["manual", "schedule", "natural_language"],
            },
            enabled: {
              type: "boolean",
            },
            cronExpression: {
              type: "string",
              description: "Five-field cron expression for schedule triggers.",
            },
            prompt: {
              type: "string",
              description: "Optional instruction to use when the schedule runs.",
            },
            notificationChannel: {
              type: "string",
              enum: ["sms"],
            },
            notificationTarget: {
              type: "string",
            },
          },
          required: ["type"],
        },
      },
    },
  }),
};
