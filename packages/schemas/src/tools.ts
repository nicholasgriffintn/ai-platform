import z from "zod/v4";

export { mergeToolIds, normaliseToolIds, readToolIds } from "./tool-ids";

const TOOL_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;

export const toolSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
});

export const toolIdSchema = z.string().regex(TOOL_ID_PATTERN);
export const toolIdsSchema = z.array(toolIdSchema);

export const toolsResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: z.array(toolSchema),
});

export type ToolId = z.infer<typeof toolIdSchema>;
