import z from "zod/v4";

export const CONFLUENCE_KNOWLEDGE_RECIPE_ID = "confluence-project-knowledge";
export const CONFLUENCE_PAGE_READ_OPERATION = "CONFLUENCE_GET_PAGE_BY_ID";
export const SOURCE_KNOWLEDGE_SYNC_TASK_TYPE = "source_knowledge_sync";

export const knowledgeSyncPageSchema = z
  .object({
    pageId: z.string().regex(/^\d+$/).max(100),
    readParameters: z
      .record(z.string(), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 10_000, {
        error: "Page read parameters are too large",
      }),
  })
  .strict();

export const createKnowledgeSyncSchema = z
  .object({
    projectId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    connectionId: z.string().min(1).max(200),
    pages: z
      .array(knowledgeSyncPageSchema)
      .min(1)
      .max(100)
      .refine((pages) => new Set(pages.map((page) => page.pageId)).size === pages.length, {
        error: "Select each page once",
      }),
    intervalMinutes: z.number().int().min(5).max(1440).default(60),
  })
  .strict();

export const knowledgeSyncSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    status: z.enum(["active", "paused"]),
    pageCount: z.number().int().nonnegative(),
    cursor: z.number().int().nonnegative(),
    lastSuccessfulAt: z.string().nullable(),
    lastError: z.string().nullable(),
    nextSyncAt: z.string(),
    intervalMinutes: z.number().int().positive(),
    canManage: z.boolean(),
  })
  .strict();
export const knowledgeSyncListSchema = z.object({ syncs: z.array(knowledgeSyncSchema) });
export const updateKnowledgeSyncSchema = z
  .object({
    action: z.enum(["pause", "resume", "refresh"]),
  })
  .strict();
export type KnowledgeSyncPage = z.infer<typeof knowledgeSyncPageSchema>;
export type CreateKnowledgeSync = z.infer<typeof createKnowledgeSyncSchema>;
export type KnowledgeSync = z.infer<typeof knowledgeSyncSchema>;
export type UpdateKnowledgeSync = z.infer<typeof updateKnowledgeSyncSchema>;
