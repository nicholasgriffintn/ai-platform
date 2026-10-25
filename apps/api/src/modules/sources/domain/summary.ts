import {
  SOURCE_SUMMARY_METADATA_KEY,
  sourceContentSummarySchema,
  type SourceContentSummary,
} from "@ngriffin_uk/polychat-schemas";

export function readSourceSummary(metadata: Record<string, unknown>): SourceContentSummary | null {
  const parsed = sourceContentSummarySchema.safeParse(metadata[SOURCE_SUMMARY_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}

export function renderSourceSummary(summary: SourceContentSummary): string {
  return [summary.summary, ...summary.keyPoints.map((point) => `- ${point}`)].join("\n");
}
