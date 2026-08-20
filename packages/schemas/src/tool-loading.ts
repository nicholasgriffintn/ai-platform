import z from "zod/v4";

export const TOOL_LOADING_MODES = ["auto", "eager", "deferred"] as const;

export const toolLoadingModeSchema = z.enum(TOOL_LOADING_MODES);

export type ToolLoadingMode = z.infer<typeof toolLoadingModeSchema>;

export const DEFERRED_TOOL_AUTO_THRESHOLD_BYTES = 8000;

export const DEFERRED_TOOL_INDEX_MAX_ENTRIES = 120;
