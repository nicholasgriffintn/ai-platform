import {
  deriveDocumentStatistics,
  readSourceDocumentMetadata,
  SOURCE_SUMMARY_METADATA_KEY,
  sourceContentSummarySchema,
  type DocumentMetadata,
  type Source,
  type SourceDocumentMetadata,
} from "@ngriffin_uk/polychat-schemas";

export function buildNoteMetadata(
  source: Pick<Source, "metadata">,
  text: string,
): DocumentMetadata {
  const summary = sourceContentSummarySchema.safeParse(
    source.metadata[SOURCE_SUMMARY_METADATA_KEY],
  );

  return {
    ...(summary.success ? { summary: summary.data.summary, keyTopics: summary.data.topics } : {}),
    ...readSourceDocumentMetadata(source.metadata),
    ...deriveDocumentStatistics(text),
  };
}

export function toSourceDocumentMetadata(metadata: DocumentMetadata): SourceDocumentMetadata {
  return {
    ...(metadata.summary ? { summary: metadata.summary } : {}),
    ...(metadata.editorial ? { editorial: metadata.editorial } : {}),
    ...(metadata.tags?.length ? { tags: metadata.tags } : {}),
    ...(metadata.keyTopics?.length ? { keyTopics: metadata.keyTopics } : {}),
    ...(metadata.contentType ? { contentType: metadata.contentType } : {}),
    ...(metadata.sentiment ? { sentiment: metadata.sentiment } : {}),
    ...(metadata.sourceType ? { sourceType: metadata.sourceType } : {}),
    ...(metadata.capturedFrom ? { capturedFrom: metadata.capturedFrom } : {}),
  };
}

export function withoutGeneratedFields(metadata: SourceDocumentMetadata): SourceDocumentMetadata {
  const { summary: _summary, keyTopics: _keyTopics, ...kept } = metadata;

  return kept;
}
