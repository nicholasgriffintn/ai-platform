import z from "zod/v4";

import { recipeConnectorProviderSchema } from "./apps.js";

export const createSourceSyncSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    provider: recipeConnectorProviderSchema,
    accountId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    rootId: z.string().trim().min(1).max(4096),
  })
  .strict();

export const sourceSyncSchema = z
  .object({
    id: z.string(),
    projectId: z.string().nullable(),
    provider: recipeConnectorProviderSchema,
    title: z.string(),
    rootId: z.string(),
    connectionId: z.string(),
    status: z.enum(["pending", "syncing", "available", "failed", "paused"]),
    lastSyncedAt: z.string().nullable(),
    nextSyncAt: z.string().nullable(),
    documentCount: z.number().int().nonnegative(),
    error: z.string().nullable(),
  })
  .strict();

export const sourceSyncListSchema = z.object({ syncs: z.array(sourceSyncSchema) }).strict();
export const sourceSyncTaskDataSchema = z
  .object({
    syncId: z.string().min(1),
    runId: z.string().min(1),
    page: z.number().int().nonnegative(),
  })
  .strict();
export const SOURCE_SYNC_TASK_TYPE = "source_sync";
export const sourceSyncCheckpointSchema = z
  .record(z.string().max(200), z.json())
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).length <= 256 * 1024,
    "Sync checkpoint is too large",
  );

export const knowledgeDocumentPermissionsSchema = z.object({
  public: z.boolean(),
  emails: z.array(z.email()).max(2000),
  validUntil: z.iso.datetime({ offset: true }).nullable(),
});

export const knowledgeSyncDocumentSchema = z.object({
  id: z.string().min(1).max(2048),
  title: z.string().min(1).max(4096),
  version: z.string().min(1).max(2048).nullable(),
  sourceUrl: z.url().max(2048).nullable(),
  data: z.unknown(),
});

export const knowledgeSyncPageSchema = z.object({
  documents: z.array(knowledgeSyncDocumentSchema).max(20),
  checkpoint: sourceSyncCheckpointSchema,
  complete: z.boolean(),
});

export type SourceSyncCheckpoint = z.infer<typeof sourceSyncCheckpointSchema>;
export type KnowledgeDocumentPermissions = z.infer<typeof knowledgeDocumentPermissionsSchema>;
export type KnowledgeSyncDocument = z.infer<typeof knowledgeSyncDocumentSchema>;
export type KnowledgeSyncPage = z.infer<typeof knowledgeSyncPageSchema>;
export type CreateSourceSyncInput = z.infer<typeof createSourceSyncSchema>;
export type SourceSync = z.infer<typeof sourceSyncSchema>;
