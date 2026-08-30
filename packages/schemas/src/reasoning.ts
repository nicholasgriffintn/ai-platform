import z from "zod/v4";

export const REASONING_EFFORT_LEVELS = [
  "none",
  "simulated-thinking",
  "thinking",
  "default",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export const reasoningEffortSchema = z.enum(REASONING_EFFORT_LEVELS);

export const reasoningSettingsSchema = z.object({
  effort: reasoningEffortSchema.optional(),
});

export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;
