import z from "zod/v4";

export const COMPARISON_TOOL_NAME = "compare_and_conclude";
export const COMPARISON_RENDERER = "comparison";

export const comparisonRequestOptionsSchema = z
  .object({
    sourceMessageId: z.string().min(1).describe("The assistant reply to compare."),
  })
  .strict();

export const comparisonSpendSchema = z.object({
  costUsd: z.number().nonnegative().nullable(),
  pricedCalls: z.number().int().nonnegative(),
  totalCalls: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

export const comparisonAnswerSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1).optional(),
  content: z.string(),
  isOriginal: z.boolean(),
});

export const comparisonDisagreementSchema = z.object({
  point: z.string().trim().min(1),
  positions: z.array(
    z.object({ model: z.string().trim().min(1), position: z.string().trim().min(1) }),
  ),
});

export const comparisonConclusionSchema = z.object({
  agreements: z.array(z.string().trim().min(1)).default([]),
  disagreements: z.array(comparisonDisagreementSchema).default([]),
  conclusion: z.string().trim().min(1),
});

export const comparisonResultSchema = comparisonConclusionSchema.extend({
  answers: z.array(comparisonAnswerSchema),
  spend: comparisonSpendSchema,
});

export type ComparisonRequestOptions = z.infer<typeof comparisonRequestOptionsSchema>;
export type ComparisonSpend = z.infer<typeof comparisonSpendSchema>;
export type ComparisonAnswer = z.infer<typeof comparisonAnswerSchema>;
export type ComparisonConclusion = z.infer<typeof comparisonConclusionSchema>;
export type ComparisonResult = z.infer<typeof comparisonResultSchema>;
