import z from "zod/v4";

export const knowledgeSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    projectId: z.string().min(1).optional(),
    type: z.string().min(1).max(80).optional(),
    topK: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export const knowledgePassageSchema = z
  .object({
    id: z.string(),
    chunkId: z.string(),
    chunkIndex: z.number().int().nonnegative(),
    title: z.string(),
    content: z.string(),
    type: z.string(),
    score: z.number(),
    rankingMethod: z.string(),
    sourceUrl: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const knowledgeSearchResponseSchema = z
  .object({
    documents: z.array(knowledgePassageSchema),
    semanticSearchAvailable: z.boolean(),
  })
  .strict();

export const knowledgeIndexStatusSchema = z
  .object({
    sourceId: z.string(),
    status: z.enum(["pending", "indexing", "available", "failed", "unavailable"]),
    indexedAt: z.string().nullable(),
    managed: z.boolean(),
  })
  .strict();

export const knowledgeStatusResponseSchema = z
  .object({
    sources: z.array(knowledgeIndexStatusSchema),
  })
  .strict();

export const sourceIndexTaskDataSchema = z
  .object({ sourceId: z.string().min(1), revision: z.number().int().positive() })
  .strict();
export const SOURCE_INDEX_TASK_TYPE = "source_index";

export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchSchema>;
export type KnowledgePassage = z.infer<typeof knowledgePassageSchema>;
export type KnowledgeSearchResponse = z.infer<typeof knowledgeSearchResponseSchema>;
export type KnowledgeIndexStatus = z.infer<typeof knowledgeIndexStatusSchema>;
