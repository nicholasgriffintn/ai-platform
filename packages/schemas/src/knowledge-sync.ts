import z from "zod/v4";

import { listSchema } from "./platform/list.js";

export const KNOWLEDGE_FEED_METADATA_KEY = "knowledgeFeed";
export const KNOWLEDGE_FEED_INTERVAL_MINUTES = 360;

const fieldPathSchema = z
  .array(z.union([z.string().min(1).max(200), z.number().int().nonnegative()]))
  .min(1)
  .max(16);

export const knowledgeDocumentMappingSchema = z
  .object({
    id: fieldPathSchema.optional(),
    title: fieldPathSchema.optional(),
    content: z
      .object({
        path: fieldPathSchema.optional(),
        format: z.enum(["text", "html", "base64", "json"]).default("text"),
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
    title: z.string().trim().min(1).max(200).optional(),
    operation: z.string().trim().min(1).max(200),
    documentMapping: knowledgeDocumentMappingSchema,
    readParameters: z
      .record(z.string(), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 10_000, {
        error: "Resource read parameters are too large",
      }),
  })
  .strict();

export const createConnectorKnowledgeSyncSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    notebookId: z.string().min(1).optional(),
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
  .strict()
  .refine((value) => Boolean(value.projectId) !== Boolean(value.notebookId), {
    error: "Sync into either a project or a notebook",
  });

export const knowledgeSyncKindSchema = z.enum(["connector", "rss", "news", "web"]);

export const knowledgeFeedSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("rss"),
      url: z.url({ protocol: /^https?$/ }).max(2048),
    })
    .strict(),
  z
    .object({
      kind: z.literal("news"),
      query: z.string().trim().min(2).max(200),
      country: z.string().trim().length(2).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("web"),
      query: z.string().trim().min(2).max(200),
    })
    .strict(),
]);

export const createFeedKnowledgeSyncSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    notebookId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    feed: knowledgeFeedSchema,
    intervalMinutes: z.number().int().min(60).max(1440).default(KNOWLEDGE_FEED_INTERVAL_MINUTES),
  })
  .strict()
  .refine((value) => !(value.projectId && value.notebookId), {
    error: "Follow into your library, a project or a notebook",
  });

export const createKnowledgeSyncSchema = z.union([
  createConnectorKnowledgeSyncSchema,
  createFeedKnowledgeSyncSchema,
]);

export const knowledgeSyncListQuerySchema = z
  .object({
    project_id: z.string().min(1).optional(),
    notebook_id: z.string().min(1).optional(),
  })
  .refine((value) => !(value.project_id && value.notebook_id), {
    error: "List your library's, a project's or a notebook's syncs",
  });

export const knowledgeSyncSchema = z
  .object({
    id: z.string(),
    projectId: z.string().nullable(),
    notebookId: z.string().nullable(),
    title: z.string(),
    kind: knowledgeSyncKindSchema,
    feed: knowledgeFeedSchema.nullable(),
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
export const knowledgeSyncListSchema = listSchema(knowledgeSyncSchema);
export const updateKnowledgeSyncSchema = z
  .object({
    action: z.enum(["pause", "resume", "refresh"]),
  })
  .strict();
export type KnowledgeSyncResource = z.infer<typeof knowledgeSyncResourceSchema>;
export type KnowledgeDocumentMapping = z.infer<typeof knowledgeDocumentMappingSchema>;
export type CreateKnowledgeSync = z.infer<typeof createKnowledgeSyncSchema>;
export type CreateConnectorKnowledgeSync = z.infer<typeof createConnectorKnowledgeSyncSchema>;
export type CreateFeedKnowledgeSync = z.infer<typeof createFeedKnowledgeSyncSchema>;
export type KnowledgeSyncKind = z.infer<typeof knowledgeSyncKindSchema>;
export type KnowledgeFeed = z.infer<typeof knowledgeFeedSchema>;
export type KnowledgeSync = z.infer<typeof knowledgeSyncSchema>;
export type UpdateKnowledgeSync = z.infer<typeof updateKnowledgeSyncSchema>;
