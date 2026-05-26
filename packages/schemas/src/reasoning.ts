import z from "zod/v4";

export const REASONING_EFFORT_LEVELS = [
	"none",
	"simulated-thinking",
	"thinking",
	"low",
	"medium",
	"high",
	"xhigh",
] as const;

export const reasoningEffortSchema = z.enum(REASONING_EFFORT_LEVELS);

export const reasoningSettingsSchema = z.object({
	effort: reasoningEffortSchema.optional(),
});
