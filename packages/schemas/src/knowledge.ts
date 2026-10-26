import z from "zod/v4";

export const KNOWLEDGE_ORIGINS = [
  "upload",
  "manual",
  "note",
  "page",
  "feed",
  "topic",
  "connector",
  "device",
  "generated",
  "evidence",
  "site",
  "research",
  "repository",
] as const;

export const knowledgeOriginSchema = z.enum(KNOWLEDGE_ORIGINS);

export const KNOWLEDGE_ORIGIN_METADATA_KEY = "origin";
export const KNOWLEDGE_UPSTREAM_METADATA_KEY = "upstream";
export const KNOWLEDGE_BODY_METADATA_KEY = "body";
export const KNOWLEDGE_ENRICHMENTS_METADATA_KEY = "enrichments";
export const KNOWLEDGE_RETRIEVAL_METADATA_KEY = "retrieval";
export const KNOWLEDGE_EXPIRES_METADATA_KEY = "expiresAt";
export const KNOWLEDGE_CLASSIFICATION_METADATA_KEY = "classification";

export const KNOWLEDGE_INLINE_BODY_CHARACTERS = 24_000;
export const KNOWLEDGE_BODY_PREVIEW_CHARACTERS = 4_000;

export const knowledgeUpstreamSchema = z
  .object({
    provider: z.string().min(1).max(100),
    externalId: z.string().min(1).max(500),
    revision: z.union([z.string().min(1).max(200), z.number()]).optional(),
    url: z.string().max(2048).optional(),
    updatedAt: z.string().max(64).optional(),
    syncedAt: z.string().max(64).optional(),
  })
  .strict();

export const knowledgeBodySchema = z
  .object({
    key: z.string().min(1).max(1024),
    characters: z.number().int().nonnegative(),
    hash: z.string().min(1),
  })
  .strict();

export const knowledgeEnrichmentStatusSchema = z.enum(["done", "failed", "skipped"]);

export const knowledgeEnrichmentStateSchema = z
  .object({
    version: z.number().int().positive(),
    status: knowledgeEnrichmentStatusSchema,
    contentHash: z.string().min(1),
    at: z.string().min(1),
    error: z.string().max(500).optional(),
  })
  .strict();

export const knowledgeRetrievalSchema = z.enum(["included", "excluded"]);

export const knowledgeClassificationSchema = z
  .object({
    topics: z
      .array(z.string().trim().min(1).max(60))
      .max(6)
      .describe("Short, reusable subject names a library would file this under."),
    entities: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80).describe("The name as it should be filed."),
            type: z.enum(["person", "organisation", "place", "product", "project", "event"]),
          })
          .strict(),
      )
      .max(10)
      .describe("The people, organisations, places, products, projects or events it is about."),
    documentType: z
      .enum([
        "article",
        "report",
        "email",
        "message",
        "meeting",
        "note",
        "specification",
        "code",
        "dataset",
        "reference",
        "other",
      ])
      .describe("What sort of document this is."),
    language: z.string().trim().min(2).max(12).describe("The main language as a BCP 47 tag."),
  })
  .strict();

export const KNOWLEDGE_RELATIONS = [
  "cites",
  "duplicates",
  "updates",
  "mentions",
  "derived_from",
] as const;

export const knowledgeRelationKindSchema = z.enum(KNOWLEDGE_RELATIONS);

export const knowledgeRelationSchema = z
  .object({
    sourceId: z.string().min(1),
    relatedSourceId: z.string().min(1),
    relation: knowledgeRelationKindSchema,
    title: z.string(),
  })
  .strict();

export const knowledgeDocumentControlsSchema = z
  .object({
    retrieval: knowledgeRetrievalSchema.optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
    sensitivity: z.enum(["personal", "internal", "confidential"]).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    error: "Choose at least one control to change",
  });

export const knowledgeDocumentStateSchema = z
  .object({
    sourceId: z.string().min(1),
    origin: knowledgeOriginSchema.nullable(),
    upstream: knowledgeUpstreamSchema.nullable(),
    retrieval: knowledgeRetrievalSchema,
    expiresAt: z.string().nullable(),
    sensitivity: z.enum(["personal", "internal", "confidential"]).nullable(),
    stored: z.enum(["inline", "body"]),
    characters: z.number().int().nonnegative(),
    indexed: z.enum(["pending", "lexical", "active"]),
    enrichments: z.array(
      z
        .object({
          name: z.string().min(1),
          label: z.string().min(1),
          status: z.enum(["pending", "done", "failed", "skipped"]),
          at: z.string().nullable(),
          error: z.string().nullable(),
        })
        .strict(),
    ),
    collections: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string(),
          kind: z.string(),
        })
        .strict(),
    ),
    relations: z.array(knowledgeRelationSchema),
  })
  .strict();

export const knowledgeEnricherSettingsSchema = z
  .object({
    summary: z.boolean().default(true),
    classify: z.boolean().default(true),
    relate: z.boolean().default(true),
  })
  .strict();

export type KnowledgeOrigin = z.infer<typeof knowledgeOriginSchema>;
export type KnowledgeUpstream = z.infer<typeof knowledgeUpstreamSchema>;
export type KnowledgeBody = z.infer<typeof knowledgeBodySchema>;
export type KnowledgeEnrichmentState = z.infer<typeof knowledgeEnrichmentStateSchema>;
export type KnowledgeEnrichmentStatus = z.infer<typeof knowledgeEnrichmentStatusSchema>;
export type KnowledgeRetrieval = z.infer<typeof knowledgeRetrievalSchema>;
export type KnowledgeClassification = z.infer<typeof knowledgeClassificationSchema>;
export type KnowledgeRelationKind = z.infer<typeof knowledgeRelationKindSchema>;
export type KnowledgeRelation = z.infer<typeof knowledgeRelationSchema>;
export type KnowledgeDocumentControls = z.infer<typeof knowledgeDocumentControlsSchema>;
export type KnowledgeDocumentState = z.infer<typeof knowledgeDocumentStateSchema>;
export type KnowledgeEnricherSettings = z.infer<typeof knowledgeEnricherSettingsSchema>;

export const knowledgeProviderStateSchema = z
  .object({
    provider: z.string().min(1),
    name: z.string().min(1),
    connected: z.boolean(),
    attached: z.boolean(),
  })
  .strict();

export const knowledgeSettingsSchema = z
  .object({
    projectId: z.string().nullable(),
    enrichers: knowledgeEnricherSettingsSchema,
    providers: z.array(knowledgeProviderStateSchema),
    canManage: z.boolean(),
  })
  .strict();

export const knowledgeSettingsQuerySchema = z
  .object({ project_id: z.string().min(1).optional() })
  .strict();

export const updateKnowledgeSettingsSchema = z
  .object({
    project_id: z.string().min(1).optional(),
    enrichers: knowledgeEnricherSettingsSchema.optional(),
    providers: z
      .array(z.object({ provider: z.string().min(1), attached: z.boolean() }).strict())
      .max(10)
      .optional(),
  })
  .strict();

export type KnowledgeProviderState = z.infer<typeof knowledgeProviderStateSchema>;
export type KnowledgeSettings = z.infer<typeof knowledgeSettingsSchema>;
export type UpdateKnowledgeSettings = z.infer<typeof updateKnowledgeSettingsSchema>;
