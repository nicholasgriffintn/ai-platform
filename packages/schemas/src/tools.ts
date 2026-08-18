import z from "zod/v4";

import {
  toolFormSchema,
  toolFunctionTypeSchema,
  toolResponseSchema,
  capabilityThemeSchema,
} from "./apps";

export { mergeToolIds, normaliseToolIds, readToolIds } from "./tool-ids";

const TOOL_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;

export const toolCategories = [
  "Research",
  "Creative",
  "Code",
  "Productivity",
  "Automation",
  "Collaboration",
  "Guidance",
  "Other",
] as const;

export const toolCategorySchema = z.enum(toolCategories);

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: toolCategorySchema,
  isDefault: z.boolean().optional(),
});

export const toolIdSchema = z.string().regex(TOOL_ID_PATTERN);
export const toolIdsSchema = z.array(toolIdSchema);

/**
 * A tool a person can run directly from the interface, rather than waiting for a model to
 * call it. The form is derived from the tool's own input schema, so it stays in step with
 * what the model sees.
 */
export const runnableToolSchema = toolSchema.extend({
  icon: z.string().optional(),
  theme: capabilityThemeSchema.optional(),
  costPerCall: z.number().optional(),
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

export const toolsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(toolSchema),
});

export type Tool = z.infer<typeof toolSchema>;
export type ToolCategory = z.infer<typeof toolCategorySchema>;
export type ToolId = z.infer<typeof toolIdSchema>;
export type RunnableTool = z.infer<typeof runnableToolSchema>;
export type RunnableToolResponse = z.infer<typeof runnableToolResponseSchema>;
