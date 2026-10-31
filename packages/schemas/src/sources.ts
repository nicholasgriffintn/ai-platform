import z from "zod/v4";

import { sourceDocumentMetadataSchema } from "./documents.js";
import { knowledgeOriginSchema } from "./knowledge.js";
import { listSchema } from "./platform/list.js";
import { readingFormIdSchema } from "./reading.js";
import { sourceGenerationTypeSchema } from "./source-media.js";

export const sourceKindSchema = z.enum([
  "file",
  "memory",
  "text",
  "url",
  "connector",
  "repository",
  "podcast",
]);
const creatableSourceKindSchema = z.enum(["file", "text", "url", "connector", "repository"]);

export const sourceStatusSchema = z.enum(["processing", "available", "failed", "archived"]);
export const sourceScopeSchema = z.enum(["personal", "project"]);
export const sourceCollectionKindSchema = z.enum([
  "general",
  "memory",
  "context",
  "podcast",
  "topic",
  "entity",
]);

export const sourceFileSchema = z
  .object({
    key: z.string().min(1).max(1024),
    mimeType: z.string().min(1).max(255),
    filename: z.string().max(255).nullable(),
    byteSize: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const sourceSchema = z
  .object({
    id: z.string().min(1),
    createdByUserId: z.number().int().positive(),
    projectId: z.string().nullable(),
    conversationId: z.string().nullable(),
    connectionId: z.string().nullable(),
    kind: sourceKindSchema,
    title: z.string().trim().min(1).max(200),
    status: sourceStatusSchema,
    content: z.string().nullable(),
    provider: z.string().max(100).nullable(),
    externalUri: z.string().max(2048).nullable(),
    vectorId: z.string().max(255).nullable(),
    metadata: z.record(z.string(), z.unknown()),
    file: sourceFileSchema.nullable(),
    revision: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const sourceSummarySchema = sourceSchema.omit({ content: true });

const knowledgeKindSchema = z.string().trim().min(1).max(80);

export const knowledgeResultTypeSchema = z.enum(["source", "output", "memory", "external"]);

export const knowledgeSearchFiltersSchema = z
  .object({
    kinds: z.array(knowledgeKindSchema).max(12).optional(),
    resourceTypes: z
      .array(z.enum(["source", "output", "memory"]))
      .max(3)
      .optional(),
    origins: z.array(knowledgeOriginSchema).max(13).optional(),
    providers: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    collectionIds: z.array(z.string().min(1)).max(50).optional(),
    syncIds: z.array(z.string().min(1)).max(50).optional(),
    since: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    includeExternal: z.boolean().optional(),
  })
  .strict();

export const projectKnowledgeSearchQuerySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    query: z.string().trim().min(1).max(1000),
    top_k: z.coerce.number().int().min(1).max(30).optional(),
    sourceIds: z.array(z.string().min(1)).max(300).optional(),
  })
  .extend(knowledgeSearchFiltersSchema.shape)
  .strict();

const csvList = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.split(",").filter(Boolean) : value),
    z.array(schema),
  );

export const sourceCollectionListQuerySchema = z.object({
  project_id: z.string().min(1).optional(),
  kinds: csvList(sourceCollectionKindSchema).optional(),
});

export const knowledgeSearchQuerySchema = z
  .object({
    project_id: z.string().min(1).optional(),
    query: z.string().trim().min(1).max(1000),
    top_k: z.coerce.number().int().min(1).max(30).optional(),
    kinds: csvList(knowledgeKindSchema).optional(),
    resource_types: csvList(z.enum(["source", "output"])).optional(),
    origins: csvList(knowledgeOriginSchema).optional(),
    providers: csvList(z.string().trim().min(1).max(100)).optional(),
    collection_ids: csvList(z.string().min(1)).optional(),
    sync_ids: csvList(z.string().min(1)).optional(),
    since: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    include_external: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export const projectKnowledgeSearchResponseSchema = z.object({
  status: z.literal("success"),
  data: z.array(
    z.object({
      id: z.string(),
      sourceId: z.string(),
      chunkId: z.string(),
      chunkIndex: z.number().int().nonnegative(),
      resultType: knowledgeResultTypeSchema,
      title: z.string(),
      content: z.string(),
      type: z.string(),
      origin: knowledgeOriginSchema.nullable(),
      provider: z.string().nullable(),
      score: z.number(),
      rankingMethod: z.string(),
      provenance: z.object({
        projectId: z.string().nullable(),
        sourceRevision: z.number().int().positive(),
        externalUri: z.string().nullable(),
        updatedAt: z.string().nullable(),
        upstreamRevision: z
          .union([z.number().int().positive(), z.string().min(1).max(200)])
          .nullable(),
        lastSyncedAt: z.string().nullable(),
      }),
    }),
  ),
  external: z.array(z.object({ provider: z.string(), error: z.string().nullable() })).optional(),
});

export type ProjectKnowledgeSearchQuery = z.infer<typeof projectKnowledgeSearchQuerySchema>;
export type ProjectKnowledgeSearchResponse = z.infer<typeof projectKnowledgeSearchResponseSchema>;

export const createSourceSchema = z
  .object({
    projectId: z.string().min(1).nullable().optional(),
    conversationId: z.string().min(1).nullable().optional(),
    connectionId: z.string().min(1).nullable().optional(),
    kind: creatableSourceKindSchema,
    title: z.string().trim().min(1).max(200),
    status: sourceStatusSchema.default("available"),
    content: z.string().max(500_000).nullable().optional(),
    provider: z.string().trim().min(1).max(100).nullable().optional(),
    externalUri: z.url().max(2048).nullable().optional(),
    vectorId: z.string().trim().min(1).max(255).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    file: sourceFileSchema.nullable().optional(),
  })
  .strict();

export const SOURCE_EDIT_SESSION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const updateSourceSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: sourceStatusSchema.optional(),
    content: z.string().max(500_000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    document: sourceDocumentMetadataSchema.optional(),
    expectedRevision: z.number().int().positive().optional(),
    editSession: z.string().regex(SOURCE_EDIT_SESSION_PATTERN).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.status !== undefined ||
      value.content !== undefined ||
      value.metadata !== undefined ||
      value.document !== undefined,
    { error: "At least one source field must be provided" },
  )
  .refine((value) => value.editSession === undefined || value.content !== undefined, {
    error: "An edit session only applies to a content change",
    path: ["editSession"],
  });

export const sourceRevisionOperationSchema = z.enum(["created", "updated", "restored"]);

export const sourceRevisionSchema = z
  .object({
    id: z.string().min(1),
    revision: z.number().int().positive(),
    title: z.string(),
    content: z.string(),
    operation: sourceRevisionOperationSchema,
    restoredFromRevision: z.number().int().positive().nullable(),
    createdByUserId: z.number().int().positive(),
    createdAt: z.string(),
  })
  .strict();

export const sourceRevisionListSchema = listSchema(sourceRevisionSchema);

export const restoreSourceRevisionSchema = z
  .object({
    revision: z.number().int().positive(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const formatSourceSchema = z
  .object({ prompt: z.string().trim().max(2000).optional() })
  .strict();

export const formatSourceResponseSchema = z
  .object({
    content: z.string().describe("The reworked text. Nothing is saved until you save it."),
  })
  .strict();

export const generateNotesFromMediaSchema = z.object({
  url: z.url().describe("The audio/video URL to transcribe and analyze."),
  outputs: z
    .array(
      z.enum([
        "concise_summary",
        "detailed_outline",
        "key_takeaways",
        "action_items",
        "meeting_minutes",
        "qa_extraction",
        "smart_timestamps",
      ]),
    )
    .min(1)
    .describe("Which outputs to generate. Can select multiple."),
  noteType: z
    .enum([
      "general",
      "meeting",
      "training",
      "lecture",
      "interview",
      "recording",
      "webinar",
      "tutorial",
      "video_content",
      "educational_video",
      "documentary",
      "other",
    ])
    .default("general")
    .describe("Adjusts prompt style for the content type."),
  extraPrompt: z.string().optional().describe("Additional instructions."),
  timestamps: z.boolean().optional().describe("Whether to enable timestamped transcription."),
});

export const generateNotesFromMediaResponseSchema = z.object({
  content: z.string().describe("Generated notes content in Markdown."),
});

export const enrichSourceSchema = z
  .object({
    enricher: z.string().trim().min(1).max(40),
    readAs: readingFormIdSchema.optional(),
  })
  .strict();

export const sourceListResponseSchema = listSchema(sourceSummarySchema);

export const sourceDetailListResponseSchema = listSchema(sourceSchema);

export const sourceListScopeSchema = z.enum(["all", "context", "conversation"]);

export const sourceListQuerySchema = z
  .object({
    project_id: z.string().min(1).optional(),
    kind: sourceKindSchema.optional(),
    generation: sourceGenerationTypeSchema.optional(),
    scope: sourceListScopeSchema.default("all"),
  })
  .strict()
  .refine((query) => query.scope === "all" || query.project_id, {
    message: "Context and conversation sources need a project_id",
  });

export const sourceCollectionSchema = z
  .object({
    id: z.string().min(1),
    createdByUserId: z.number().int().positive(),
    projectId: z.string().nullable(),
    title: z.string().min(1).max(120),
    description: z.string().max(500).nullable(),
    kind: sourceCollectionKindSchema,
    sourceCount: z.number().int().nonnegative(),
    outputCount: z.number().int().nonnegative(),
    hasFeed: z.boolean(),
    readAs: readingFormIdSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const updateSourceCollectionSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    readAs: readingFormIdSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    error: "Change at least one folder field",
  });

export const createSourceCollectionSchema = z
  .object({
    projectId: z.string().min(1).nullable().optional(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    kind: z.enum(["general", "memory", "podcast"]).default("general"),
  })
  .strict();

export const sourceCollectionListResponseSchema = listSchema(sourceCollectionSchema);

export const addCollectionSourcesSchema = z
  .object({ sourceIds: z.array(z.string().min(1)).min(1).max(100) })
  .strict();

export const addCollectionOutputsSchema = z
  .object({ outputIds: z.array(z.string().min(1)).min(1).max(100) })
  .strict();

export const setProjectContextSourcesSchema = z
  .object({ project_id: z.string().min(1), sourceIds: z.array(z.string().min(1)).max(100) })
  .strict();

export const providerConnectionSummarySchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1).max(100),
    kind: z.string().min(1).max(80),
    externalId: z.string().max(200).nullable(),
    status: z.enum(["connected", "invalid", "revoked"]),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export type SourceKind = z.infer<typeof sourceKindSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceFile = z.infer<typeof sourceFileSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourceSummary = z.infer<typeof sourceSummarySchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type SourceRevision = z.infer<typeof sourceRevisionSchema>;
export type RestoreSourceRevisionInput = z.infer<typeof restoreSourceRevisionSchema>;
export type FormatSourceInput = z.infer<typeof formatSourceSchema>;
export type GenerateNotesFromMediaInput = z.infer<typeof generateNotesFromMediaSchema>;
export type EnrichSourceInput = z.infer<typeof enrichSourceSchema>;
export type UpdateSourceCollectionInput = z.infer<typeof updateSourceCollectionSchema>;
export type SourceCollection = z.infer<typeof sourceCollectionSchema>;
export type SourceCollectionKind = z.infer<typeof sourceCollectionKindSchema>;
export type CreateSourceCollectionInput = z.infer<typeof createSourceCollectionSchema>;
export type ProviderConnectionSummary = z.infer<typeof providerConnectionSummarySchema>;
