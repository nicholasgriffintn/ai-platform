import z from "zod/v4";

export const SANDBOX_ENVIRONMENT_CACHE_PLATFORM_VERSION = "environment-v2";
export const SANDBOX_ENVIRONMENT_CACHE_PREFIX = "environment-cache/";

export const sandboxDirectoryBackupSchema = z
  .object({
    id: z.uuid(),
    dir: z.string().trim().min(1),
    size: z.number().int().nonnegative(),
    sha256: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i),
    format: z.literal("tar+zstd/1"),
    name: z.string().trim().min(1).optional(),
  })
  .strict();

export type SandboxDirectoryBackup = z.infer<typeof sandboxDirectoryBackupSchema>;

export function sandboxEnvironmentCacheObjectKey(
  backup: Pick<SandboxDirectoryBackup, "id">,
): string {
  return `${SANDBOX_ENVIRONMENT_CACHE_PREFIX}${backup.id}.tar.zst`;
}

export const sandboxEnvironmentCacheStatusSchema = z.enum(["ready", "invalidated", "failed"]);

export const sandboxEnvironmentCacheRecordSchema = z
  .object({
    cacheKey: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i),
    backup: sandboxDirectoryBackupSchema,
    generation: z.number().int().nonnegative(),
    repositoryRevision: z.string().trim().min(1),
    configurationRevision: z.string().trim().min(1),
    platformVersion: z.string().trim().min(1),
    status: sandboxEnvironmentCacheStatusSchema,
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    invalidationReason: z.string().trim().min(1).optional(),
    invalidatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const sandboxEnvironmentCacheSummarySchema = sandboxEnvironmentCacheRecordSchema.omit({
  backup: true,
});

export const sandboxEnvironmentCacheActionSchema = z
  .object({ action: z.enum(["rebuild", "delete"]) })
  .strict();

export const sandboxEnvironmentCacheActionResponseSchema = z
  .object({
    environmentCache: sandboxEnvironmentCacheSummarySchema.nullable(),
    storageDeletion: z.enum(["deleted", "not_found", "failed"]),
    warning: z.string().trim().min(1).optional(),
  })
  .strict();

export type SandboxEnvironmentCacheRecord = z.infer<typeof sandboxEnvironmentCacheRecordSchema>;
export type SandboxEnvironmentCacheSummary = z.infer<typeof sandboxEnvironmentCacheSummarySchema>;
export type SandboxEnvironmentCacheAction = z.infer<typeof sandboxEnvironmentCacheActionSchema>;
export type SandboxEnvironmentCacheActionResponse = z.infer<
  typeof sandboxEnvironmentCacheActionResponseSchema
>;

export function toSandboxEnvironmentCacheSummary(
  record: SandboxEnvironmentCacheRecord,
): SandboxEnvironmentCacheSummary {
  return {
    cacheKey: record.cacheKey,
    generation: record.generation,
    repositoryRevision: record.repositoryRevision,
    configurationRevision: record.configurationRevision,
    platformVersion: record.platformVersion,
    status: record.status,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    sizeBytes: record.sizeBytes,
    invalidationReason: record.invalidationReason,
    invalidatedAt: record.invalidatedAt,
  };
}
