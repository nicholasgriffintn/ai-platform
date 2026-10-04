import z from "zod/v4";

export const sourceSyncProviderSchema = z.enum(["googledrive"]);

export const createSourceSyncSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    provider: sourceSyncProviderSchema,
    accountId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    rootId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  })
  .strict();

export const sourceSyncSchema = z
  .object({
    id: z.string(),
    projectId: z.string().nullable(),
    provider: sourceSyncProviderSchema,
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
  .object({
    folders: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/))
      .min(1)
      .max(2000),
    folderIndex: z.number().int().nonnegative(),
    pageToken: z.string().max(4096).nullable(),
  })
  .strict();
export type SourceSyncCheckpoint = z.infer<typeof sourceSyncCheckpointSchema>;
export type SourceSyncProvider = z.infer<typeof sourceSyncProviderSchema>;
export type CreateSourceSyncInput = z.infer<typeof createSourceSyncSchema>;
export type SourceSync = z.infer<typeof sourceSyncSchema>;
