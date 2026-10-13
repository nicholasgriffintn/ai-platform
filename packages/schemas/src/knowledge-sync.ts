import z from "zod/v4";

const fieldPathSchema = z
  .array(z.union([z.string().min(1).max(200), z.number().int().nonnegative()]))
  .min(1)
  .max(16);

export const knowledgeDocumentMappingSchema = z
  .object({
    id: fieldPathSchema,
    title: fieldPathSchema,
    content: z
      .object({
        path: fieldPathSchema,
        format: z.enum(["text", "html", "base64"]).default("text"),
      })
      .strict(),
    revision: fieldPathSchema.optional(),
    url: fieldPathSchema.optional(),
    urlBase: fieldPathSchema.optional(),
    state: z
      .object({
        path: fieldPathSchema,
        archivedValues: z.array(z.union([z.string().max(100), z.boolean(), z.number()])).max(20),
        availableValues: z
          .array(z.union([z.string().max(100), z.boolean(), z.number()]))
          .min(1)
          .max(20)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const knowledgeSyncResourceSchema = z
  .object({
    resourceId: z.string().trim().min(1).max(200),
    operation: z.string().trim().min(1).max(200),
    documentMapping: knowledgeDocumentMappingSchema,
    readParameters: z
      .record(z.string(), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 10_000, {
        error: "Resource read parameters are too large",
      }),
  })
  .strict();

export const createKnowledgeSyncSchema = z
  .object({
    projectId: z.string().min(1),
    recipeId: z.string().min(1).max(200),
    integrationId: z.string().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    connectionId: z.string().min(1).max(200),
    resources: z
      .array(knowledgeSyncResourceSchema)
      .min(1)
      .max(100)
      .refine(
        (resources) =>
          new Set(resources.map((resource) => resource.resourceId)).size === resources.length,
        {
          error: "Select each resource once",
        },
      ),
    intervalMinutes: z.number().int().min(5).max(1440).default(60),
  })
  .strict();

export const knowledgeSyncSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    status: z.enum(["active", "paused"]),
    resourceCount: z.number().int().nonnegative(),
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
export type KnowledgeSyncResource = z.infer<typeof knowledgeSyncResourceSchema>;
export type KnowledgeDocumentMapping = z.infer<typeof knowledgeDocumentMappingSchema>;
export type CreateKnowledgeSync = z.infer<typeof createKnowledgeSyncSchema>;
export type KnowledgeSync = z.infer<typeof knowledgeSyncSchema>;
export type UpdateKnowledgeSync = z.infer<typeof updateKnowledgeSyncSchema>;
