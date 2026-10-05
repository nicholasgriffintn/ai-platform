import z from "zod/v4";

export const siteDataIdentifierSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const siteDataFieldNameSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)
  .refine((value) => !["constructor", "prototype"].includes(value));

export const siteCollectionFieldSchema = z
  .object({
    type: z.enum(["string", "number", "boolean"]),
    required: z.boolean().default(false),
  })
  .strict();

export const siteCollectionSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    fields: z.record(
      siteDataFieldNameSchema.refine(
        (value) => !["id", "revision", "createdAt", "updatedAt", "createdByUserId"].includes(value),
      ),
      siteCollectionFieldSchema,
    ),
    maxRecords: z.number().int().min(1).max(1000).default(1000),
  })
  .strict()
  .refine(
    (value) => Object.keys(value.fields).length > 0 && Object.keys(value.fields).length <= 40,
  );

export const siteSourceBindingSchema = z
  .object({
    kind: z.literal("source"),
    sourceId: z.string().min(1).max(200),
    pageId: siteDataIdentifierSchema,
    statePath: z
      .string()
      .max(128)
      .regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9_-]+)*$/)
      .refine(
        (value) =>
          !value
            .split("/")
            .some((part) => ["__proto__", "constructor", "prototype"].includes(part)),
      ),
  })
  .strict();

export const siteCollectionBindingSchema = siteSourceBindingSchema
  .omit({ sourceId: true })
  .extend({ kind: z.literal("collection"), collectionId: siteDataIdentifierSchema })
  .strict();
export const siteDataBindingSchema = z.discriminatedUnion("kind", [
  siteSourceBindingSchema,
  siteCollectionBindingSchema,
]);

export const siteCollectionRecordSchema = z
  .object({
    id: z.string().min(1).max(100),
    revision: z.number().int().positive(),
    values: z.record(
      siteDataFieldNameSchema,
      z.union([z.string().max(4000), z.number().finite(), z.boolean()]),
    ),
    createdAt: z.string(),
    updatedAt: z.string(),
    createdByUserId: z.number().int().positive(),
  })
  .strict();

export const siteDataActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refreshData") }).strict(),
  z
    .object({
      action: z.literal("createRecord"),
      collectionId: siteDataIdentifierSchema,
      values: siteCollectionRecordSchema.shape.values,
    })
    .strict(),
  z
    .object({
      action: z.literal("updateRecord"),
      collectionId: siteDataIdentifierSchema,
      recordId: z.string().min(1).max(100),
      expectedRecordRevision: z.number().int().positive(),
      values: siteCollectionRecordSchema.shape.values,
    })
    .strict(),
  z
    .object({
      action: z.literal("deleteRecord"),
      collectionId: siteDataIdentifierSchema,
      recordId: z.string().min(1).max(100),
      expectedRecordRevision: z.number().int().positive(),
    })
    .strict(),
]);

export const siteIntegrationScopeSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const siteDataRequestSchema = siteIntegrationScopeSchema
  .extend({ operation: siteDataActionSchema })
  .strict();
export const siteRuntimeStatusSchema = z
  .object({ enabled: z.boolean(), revision: z.number().int().positive().nullable() })
  .strict();
export const siteDataResponseSchema = z
  .object({
    revision: z.number().int().positive(),
    bindings: z.record(siteDataIdentifierSchema, z.unknown()),
    runtime: siteRuntimeStatusSchema,
  })
  .strict();

export type SiteDataBinding = z.infer<typeof siteDataBindingSchema>;
export type SiteIntegrationScope = z.infer<typeof siteIntegrationScopeSchema>;
export type SiteDataResponse = z.infer<typeof siteDataResponseSchema>;

export const siteConnectorSnapshotRequestSchema = siteIntegrationScopeSchema
  .extend({
    bindingId: siteDataIdentifierSchema,
    pageId: siteDataIdentifierSchema,
    statePath: siteSourceBindingSchema.shape.statePath,
    provider: z.string().min(1).max(100),
    operation: z.string().min(1).max(200),
    connectedAccountId: z.string().min(1).max(200),
    params: z
      .record(z.string(), z.unknown())
      .refine(
        (value) => JSON.stringify(value).length <= 32_000,
        "Connector parameters are too large",
      )
      .default({}),
    resultPath: z
      .string()
      .regex(/^\/[a-zA-Z0-9_\-/]{0,200}$/)
      .default("/"),
    fields: z
      .record(siteDataFieldNameSchema, z.string().regex(/^\/[a-zA-Z0-9_\-/]{0,200}$/))
      .refine((value) => Object.keys(value).length <= 40)
      .default({}),
  })
  .strict();
export const siteSourceRefreshRequestSchema = siteIntegrationScopeSchema
  .extend({ bindingId: siteDataIdentifierSchema })
  .strict();
export type SiteSourceRefreshRequest = z.infer<typeof siteSourceRefreshRequestSchema>;

export type SiteConnectorSnapshotRequest = z.infer<typeof siteConnectorSnapshotRequestSchema>;

export const siteRuntimeActorSchema = z
  .object({
    userId: z.number().int().positive(),
    scope: z.enum(["personal", "project"]),
    role: z.enum(["owner", "admin", "member"]),
  })
  .strict();
export type SiteRuntimeActor = z.infer<typeof siteRuntimeActorSchema>;

export const siteRuntimeRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("status") }).strict(),
  z.object({ operation: z.literal("disable"), revision: z.number().int().positive() }).strict(),
  z.object({ operation: z.literal("deleteData") }).strict(),
  z
    .object({
      operation: z.literal("activate"),
      revision: z.number().int().positive(),
      collections: z.record(siteDataIdentifierSchema, siteCollectionSchema),
    })
    .strict(),
  z
    .object({
      operation: z.literal("read"),
      revision: z.number().int().positive(),
      collectionId: siteDataIdentifierSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("operate"),
      revision: z.number().int().positive(),
      action: siteDataActionSchema,
      actor: siteRuntimeActorSchema,
    })
    .strict(),
]);
export type SiteRuntimeRequest = z.infer<typeof siteRuntimeRequestSchema>;

export type SiteCollection = z.infer<typeof siteCollectionSchema>;
export type SiteCollectionRecord = z.infer<typeof siteCollectionRecordSchema>;
export type SiteDataAction = z.infer<typeof siteDataActionSchema>;
export type SiteDataRequest = z.infer<typeof siteDataRequestSchema>;
