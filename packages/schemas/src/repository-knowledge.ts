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

export const createRepositoryKnowledgeSyncSchema = z
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

export const repositoryKnowledgeSyncSchema = z
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

export const repositoryKnowledgeSyncListSchema = z
  .object({ syncs: z.array(repositoryKnowledgeSyncSchema) })
  .strict();
export const repositoryKnowledgeSyncParamsSchema = z.object({ syncId: z.uuid() }).strict();
export const repositoryKnowledgeSyncControlSchema = z
  .object({ revision: z.number().int().positive(), action: z.enum(["sync", "pause", "resume"]) })
  .strict();
export const repositoryKnowledgeSyncTaskDataSchema = repositoryKnowledgeSyncParamsSchema;
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

export type CreateRepositoryKnowledgeSync = z.infer<typeof createRepositoryKnowledgeSyncSchema>;
export type RepositoryKnowledgeSync = z.infer<typeof repositoryKnowledgeSyncSchema>;
export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;
export type RepositoryKnowledgeSyncControl = z.infer<typeof repositoryKnowledgeSyncControlSchema>;
