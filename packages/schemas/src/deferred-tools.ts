import z from "zod/v4";

export const LOAD_TOOLS_TOOL_NAME = "load_tools";

export const DEFERRED_TOOL_LOAD_DEFAULT_LIMIT = 5;
export const DEFERRED_TOOL_LOAD_MAX_LIMIT = 15;

export const loadToolsInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      "What the tool needs to do, or the exact name of a tool listed in this tool's description.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DEFERRED_TOOL_LOAD_MAX_LIMIT)
    .default(DEFERRED_TOOL_LOAD_DEFAULT_LIMIT)
    .optional()
    .describe("Maximum number of tools to load."),
});

export type LoadToolsInput = z.infer<typeof loadToolsInputSchema>;
