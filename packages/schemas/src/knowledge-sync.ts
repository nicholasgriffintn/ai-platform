import { containsControlCharacters } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const KNOWLEDGE_SYNC_TASK_TYPE = "knowledge_sync";

export const githubKnowledgeRepositorySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  .max(200)
  .refine((value) => value.split("/").every((part) => part !== "." && part !== ".."))
  .transform((value) => value.toLowerCase());

export const knowledgePathSchema = z
  .string()
  .max(1024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !containsControlCharacters(value) &&
      (value === "" ||
        value.split("/").every((part) => Boolean(part) && part !== "." && part !== "..")) &&
      (value === "" || !value.endsWith("/")),
    { error: "Use a repository-relative path without traversal" },
  );

export const createKnowledgeSyncSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    repository: githubKnowledgeRepositorySchema,
    branch: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !containsControlCharacters(value)),
    path: knowledgePathSchema.default(""),
    installationId: z.number().int().positive(),
  })
  .strict();

export const knowledgeSyncSchema = z
  .object({
    id: z.uuid(),
    projectId: z.string().nullable(),
    createdByUserId: z.number().int().positive(),
    repository: githubKnowledgeRepositorySchema,
    branch: z.string(),
    path: knowledgePathSchema,
    installationId: z.number().int().positive(),
    status: z.enum(["idle", "syncing", "paused", "blocked", "failed"]),
    revision: z.number().int().positive(),
    documentCount: z.number().int().nonnegative(),
    lastSyncedAt: z.string().nullable(),
    lastCommit: z.string().nullable(),
    nextSyncAt: z.string(),
    errorMessage: z.string().nullable(),
  })
  .strict();

export const knowledgeSyncListSchema = z.object({ syncs: z.array(knowledgeSyncSchema) }).strict();
export const knowledgeSyncParamsSchema = z.object({ syncId: z.uuid() }).strict();
export const knowledgeSyncControlSchema = z
  .object({ revision: z.number().int().positive(), action: z.enum(["sync", "pause", "resume"]) })
  .strict();
export const knowledgeSyncTaskDataSchema = knowledgeSyncParamsSchema;
export const knowledgeSearchSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    query: z.string().trim().min(2).max(200),
    limit: z.number().int().min(1).max(15).default(5),
  })
  .strict();
export const knowledgeSearchResultSchema = z
  .object({
    sourceId: z.string(),
    title: z.string(),
    excerpt: z.string().max(4000),
    citation: z.url(),
    syncedAt: z.string(),
    commit: z.string(),
  })
  .strict();
export const knowledgeSearchResponseSchema = z
  .object({ results: z.array(knowledgeSearchResultSchema) })
  .strict();

export type CreateKnowledgeSync = z.infer<typeof createKnowledgeSyncSchema>;
export type KnowledgeSync = z.infer<typeof knowledgeSyncSchema>;
export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;
export type KnowledgeSyncControl = z.infer<typeof knowledgeSyncControlSchema>;
