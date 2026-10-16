import z from "zod/v4";

import {
  toolFormSchema,
  toolFunctionTypeSchema,
  toolResponseSchema,
  capabilityThemeSchema,
} from "./apps.js";
import { listSchema } from "./platform/list.js";
import { toolIdSchema, toolIdsSchema } from "./tool-ids.js";

export { mergeToolIds, normaliseToolIds, readToolIds } from "./tool-ids.js";
export { toolIdSchema, toolIdsSchema };

export const CURRENT_TIME_TOOL_NAME = "get_current_time";
export const CALCULATOR_TOOL_NAME = "calculate";
export const USER_INFORMATION_TOOL_NAME = "get_user_information";

export const toolCategories = [
  "Research",
  "Creative",
  "Code",
  "Productivity",
  "Automation",
  "Collaboration",
  "Other",
] as const;

export const toolCategorySchema = z.enum(toolCategories);

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: toolCategorySchema,
  isDefault: z.boolean().optional(),
  type: toolFunctionTypeSchema.optional(),
});

export const toolSelectionModeSchema = z.enum(["managed", "explicit"]);

export const runnableToolSchema = toolSchema.extend({
  icon: z.string().optional(),
  theme: capabilityThemeSchema.optional(),
  type: toolFunctionTypeSchema.optional(),
  formSchema: toolFormSchema,
  responseSchema: toolResponseSchema,
});

export const runnableToolResponseSchema = z.object({
  success: z.boolean(),
  output_id: z.string().optional(),
  data: z.object({
    message: z.string(),
    timestamp: z.iso.datetime(),
    input: z.record(z.string(), z.unknown()),
    result: z.unknown(),
  }),
});

export const runnableToolExecuteRequestSchema = z.record(z.string(), z.any());

export const toolsResponseSchema = listSchema(toolSchema);

export type Tool = z.infer<typeof toolSchema>;
export type ToolCategory = z.infer<typeof toolCategorySchema>;
export type ToolId = z.infer<typeof toolIdSchema>;
export type ToolSelectionMode = z.infer<typeof toolSelectionModeSchema>;
export type RunnableTool = z.infer<typeof runnableToolSchema>;
export type RunnableToolResponse = z.infer<typeof runnableToolResponseSchema>;
