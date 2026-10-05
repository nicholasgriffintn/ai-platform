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

export const conversationBriefParamsSchema = z.object({
  conversationId: z.string().min(1),
});

export const conversationBriefResponseSchema = z.object({
  conversationId: z.string().min(1),
  document: memoryDocumentSchema.nullable(),
});

export type MemoryDocument = z.infer<typeof memoryDocumentSchema>;

export const readMemoryDocumentSchema = z.object({
  documentId: z.string().min(1),
  revision: z.number().int().positive(),
  offset: z.number().int().nonnegative().default(0),
  maxCharacters: z.number().int().min(1).max(4000).default(4000),
});

export type ReadMemoryDocumentInput = z.infer<typeof readMemoryDocumentSchema>;

export const memoryDocumentPageSchema = z.object({
  documentId: z.string(),
  revision: z.number().int().positive(),
  content: z.string(),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
  totalCharacters: z.number().int().nonnegative(),
});

export type MemoryDocumentPage = z.infer<typeof memoryDocumentPageSchema>;

export const MEMORY_REFLECTION_TASK_TYPE = "memory_reflection";
export const memoryReflectionTaskDataSchema = z.object({
  contextId: z.string().min(1),
  conversationId: z.string().min(1),
  throughMessageId: z.string().min(1),
  afterMessageId: z.string().nullable(),
});
export type MemoryReflectionTaskData = z.infer<typeof memoryReflectionTaskDataSchema>;

export const memoryReflectionProposalSchema = z.object({
  edits: z
    .array(
      z.object({
        before: z.string().max(8000),
        after: z.string().max(8000),
        evidence: z
          .array(
            z.object({
              messageId: z.string().min(1),
              quote: z.string().min(1).max(2000),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .max(20),
  changeNote: z.string().trim().min(1).max(500),
});
export type MemoryReflectionProposal = z.infer<typeof memoryReflectionProposalSchema>;

export type MemoryDocumentSummary = z.infer<typeof memoryDocumentSummarySchema>;
export type MemoryDocumentRevision = z.infer<typeof memoryDocumentRevisionSchema>;
export type MemoryDocumentScope = z.infer<typeof memoryDocumentScopeSchema>;
export type CreateMemoryDocumentInput = z.infer<typeof createMemoryDocumentSchema>;
export type UpdateMemoryDocumentInput = z.infer<typeof updateMemoryDocumentSchema>;
export type ConversationBriefResponse = z.infer<typeof conversationBriefResponseSchema>;

export function excerptMemoryDocument(content: string, limit = 220): string {
  const flattened = content.replace(/\s+/gu, " ").trim();

  return flattened.length > limit ? `${flattened.slice(0, limit)}…` : flattened;
}
