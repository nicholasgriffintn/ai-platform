import z from "zod/v4";

export const MEMORY_DOCUMENT_MAX_CONTENT = 64 * 1024;

export const memoryDocumentNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Memory document names are kebab-case, so they read the same everywhere",
  );

export const memoryDocumentScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("personal") }),
  z.object({ type: z.literal("project"), projectId: z.string().min(1) }),
]);

export const memoryDocumentSchema = z.object({
  id: z.string(),
  name: memoryDocumentNameSchema,
  content: z.string(),
  revision: z.number().int().positive(),
  scopeType: z.enum(["personal", "project"]),
  scopeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const memoryDocumentSummarySchema = memoryDocumentSchema.omit({ content: true }).extend({
  excerpt: z.string(),
});

export const memoryDocumentRevisionSchema = z.object({
  id: z.string(),
  revision: z.number().int().positive(),
  content: z.string(),
  changeNote: z.string().nullable(),
  createdAt: z.string(),
});

export const createMemoryDocumentSchema = z.object({
  name: memoryDocumentNameSchema,
  content: z.string().max(MEMORY_DOCUMENT_MAX_CONTENT).default(""),
  projectId: z.string().min(1).optional(),
});

export const updateMemoryDocumentSchema = z.object({
  content: z.string().max(MEMORY_DOCUMENT_MAX_CONTENT),
  changeNote: z.string().trim().min(1).max(500).optional(),
  expectedRevision: z.number().int().positive(),
  projectId: z.string().min(1).optional(),
});

export const listMemoryDocumentsResponseSchema = z.object({
  documents: z.array(memoryDocumentSummarySchema),
});

export const memoryDocumentHistoryResponseSchema = z.object({
  revisions: z.array(memoryDocumentRevisionSchema),
});

export type MemoryDocument = z.infer<typeof memoryDocumentSchema>;
export type MemoryDocumentSummary = z.infer<typeof memoryDocumentSummarySchema>;
export type MemoryDocumentRevision = z.infer<typeof memoryDocumentRevisionSchema>;
export type MemoryDocumentScope = z.infer<typeof memoryDocumentScopeSchema>;
export type CreateMemoryDocumentInput = z.infer<typeof createMemoryDocumentSchema>;
export type UpdateMemoryDocumentInput = z.infer<typeof updateMemoryDocumentSchema>;

export function excerptMemoryDocument(content: string, limit = 220): string {
  const flattened = content.replace(/\s+/gu, " ").trim();

  return flattened.length > limit ? `${flattened.slice(0, limit)}…` : flattened;
}
