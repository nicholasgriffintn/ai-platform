import z from "zod/v4";

export const flagValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
  z.record(z.string(), z.unknown()),
]);

export const flagBootstrapEvaluationSchema = z.object({
  flagKey: z.string(),
  value: flagValueSchema,
  variant: z.string().optional(),
  reason: z.string(),
});

export const flagBootstrapResponseSchema = z.object({
  targetingKey: z.string().optional(),
  evaluations: z.array(flagBootstrapEvaluationSchema),
});

export type FlagBootstrapEvaluation = z.infer<typeof flagBootstrapEvaluationSchema>;
export type FlagBootstrapResponse = z.infer<typeof flagBootstrapResponseSchema>;
