import z from "zod/v4";

export const SOURCE_SUMMARY_METADATA_KEY = "summary";

export const sourceContentSummaryDraftSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .describe(
      "What the source is and what it says or concludes, in plain prose, as long as the source needs.",
    ),
  keyPoints: z
    .array(z.string().trim().min(1))
    .describe("The important facts, figures, decisions and claims, one per entry."),
  topics: z
    .array(z.string().trim().min(1))
    .describe("Short names for the subjects the source covers."),
});

export const sourceContentSummarySchema = sourceContentSummaryDraftSchema.extend({
  contentHash: z.string().min(1),
  generatedAt: z.string().min(1),
});

export type SourceContentSummaryDraft = z.infer<typeof sourceContentSummaryDraftSchema>;
export type SourceContentSummary = z.infer<typeof sourceContentSummarySchema>;
