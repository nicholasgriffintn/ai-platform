import z from "zod/v4";

export const RERANKING_MAX_DOCUMENTS = 100;
export const RERANKING_MAX_ID_LENGTH = 512;
export const RERANKING_MAX_QUERY_LENGTH = 32_768;
export const RERANKING_MAX_DOCUMENT_LENGTH = 32_768;
export const RERANKING_MAX_TOTAL_DOCUMENT_BYTES = 512 * 1_024;
export const RERANKING_MAX_METADATA_LENGTH = 512;

export const rerankingDocumentIdSchema = z.union([
  z.string().min(1).max(RERANKING_MAX_ID_LENGTH),
  z.number().int().safe(),
]);
export type RerankingDocumentId = z.infer<typeof rerankingDocumentIdSchema>;

export const rerankingDocumentSchema = z
  .object({
    id: rerankingDocumentIdSchema,
    text: z.string().min(1).max(RERANKING_MAX_DOCUMENT_LENGTH),
  })
  .strict();
export type RerankingDocument = z.infer<typeof rerankingDocumentSchema>;

function idKey(id: RerankingDocumentId): string {
  return `${typeof id}:${String(id)}`;
}

export const rerankingRequestSchema = z
  .object({
    query: z.string().min(1).max(RERANKING_MAX_QUERY_LENGTH),
    documents: z.array(rerankingDocumentSchema).min(1).max(RERANKING_MAX_DOCUMENTS),
    model: z.string().min(1).max(RERANKING_MAX_METADATA_LENGTH).optional(),
    topK: z.number().int().min(1).max(RERANKING_MAX_DOCUMENTS).optional(),
    completion_id: z.string().min(1).max(RERANKING_MAX_METADATA_LENGTH).optional(),
    conversationId: z.string().min(1).max(RERANKING_MAX_METADATA_LENGTH).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const documentIds = new Set<string>();

    for (const [index, document] of request.documents.entries()) {
      const key = idKey(document.id);

      if (documentIds.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Document IDs must be unique",
          path: ["documents", index, "id"],
        });
      }

      documentIds.add(key);
    }

    if (request.topK !== undefined && request.topK > request.documents.length) {
      context.addIssue({
        code: "custom",
        message: "topK cannot exceed the number of documents",
        path: ["topK"],
      });
    }

    const totalDocumentBytes = request.documents.reduce(
      (total, document) => total + new TextEncoder().encode(document.text).byteLength,
      0,
    );

    if (totalDocumentBytes > RERANKING_MAX_TOTAL_DOCUMENT_BYTES) {
      context.addIssue({
        code: "custom",
        message: `Documents cannot exceed ${RERANKING_MAX_TOTAL_DOCUMENT_BYTES} bytes in total`,
        path: ["documents"],
      });
    }
  });
export type RerankingRequest = z.infer<typeof rerankingRequestSchema>;

export const rerankingResultSchema = z
  .object({
    id: rerankingDocumentIdSchema,
    score: z.number().finite(),
  })
  .strict();
export type RerankingResult = z.infer<typeof rerankingResultSchema>;

export const rerankingUsageSchema = z
  .object({
    input_tokens: z.number().int().min(0).optional(),
    search_units: z.number().int().min(0).optional(),
  })
  .strict();
export type RerankingUsage = z.infer<typeof rerankingUsageSchema>;

export const rerankingResponseSchema = z
  .object({
    provider: z.string().min(1).max(RERANKING_MAX_METADATA_LENGTH),
    model: z.string().min(1).max(RERANKING_MAX_METADATA_LENGTH),
    results: z.array(rerankingResultSchema).min(1).max(RERANKING_MAX_DOCUMENTS),
    usage: rerankingUsageSchema.optional(),
  })
  .strict();
export type RerankingResponse = z.infer<typeof rerankingResponseSchema>;

export function rerankingResultsMatchRequest(
  request: Pick<RerankingRequest, "documents" | "topK">,
  results: readonly RerankingResult[],
): boolean {
  const expectedCount = request.topK ?? request.documents.length;

  if (results.length !== expectedCount) {
    return false;
  }

  const documentIds = new Set(request.documents.map((document) => idKey(document.id)));
  const resultIds = new Set<string>();

  for (const result of results) {
    const key = idKey(result.id);

    if (!documentIds.has(key) || resultIds.has(key) || !Number.isFinite(result.score)) {
      return false;
    }

    resultIds.add(key);
  }

  return true;
}
