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

export const MEMORY_DOCUMENT_TYPES = ["user", "feedback", "project", "reference"] as const;

export const memoryDocumentTypeSchema = z
  .enum(MEMORY_DOCUMENT_TYPES)
  .describe(
    "user: who the person is and how they like things. feedback: guidance on how to work with them, both corrections and approaches they confirmed. project: ongoing work, goals, decisions and constraints. reference: pointers to people, places, accounts or resources.",
  );

export const memoryDocumentScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("personal") }),
  z.object({ type: z.literal("project"), projectId: z.string().min(1) }),
]);

export const memoryDocumentSchema = z.object({
  id: z.string(),
  name: memoryDocumentNameSchema,
  description: z.string(),
  type: memoryDocumentTypeSchema.nullable(),
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

export const MEMORY_IMPORT_SOURCES = ["chatgpt", "claude", "summary"] as const;
export const memoryImportSourceSchema = z.enum(MEMORY_IMPORT_SOURCES);
export const MEMORY_IMPORT_SOURCE_LABELS: Record<(typeof MEMORY_IMPORT_SOURCES)[number], string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  summary: "a pasted summary",
};
export const MEMORY_EVIDENCE_EXCERPT_CHARACTERS = 500;

export const memoryEvidenceSchema = z.discriminatedUnion("origin", [
  z.object({
    origin: z.literal("conversation"),
    conversationId: z.string().min(1),
    messageId: z.string().min(1).optional(),
    quote: z.string().min(1),
  }),
  z.object({
    origin: z.literal("import"),
    source: memoryImportSourceSchema,
    conversationTitle: z.string().optional(),
    occurredAt: z.string().optional(),
    quote: z.string().min(1),
  }),
]);

export const memoryDocumentRevisionSchema = z.object({
  id: z.string(),
  revision: z.number().int().positive(),
  content: z.string(),
  changeNote: z.string().nullable(),
  evidence: z.array(memoryEvidenceSchema),
  createdAt: z.string(),
});

export const createMemoryDocumentSchema = z.object({
  name: memoryDocumentNameSchema,
  description: z.string().trim().optional(),
  type: memoryDocumentTypeSchema.nullable().optional(),
  content: z.string().max(MEMORY_DOCUMENT_MAX_CONTENT).default(""),
  projectId: z.string().min(1).optional(),
});

export const updateMemoryDocumentSchema = z.object({
  content: z.string().max(MEMORY_DOCUMENT_MAX_CONTENT),
  description: z.string().trim().optional(),
  type: memoryDocumentTypeSchema.nullable().optional(),
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
  evidence: z.array(memoryEvidenceSchema),
});

export type MemoryDocumentPage = z.infer<typeof memoryDocumentPageSchema>;

export const memoryPlacementSchema = z.object({
  placements: z
    .array(
      z.object({
        memory: z.number().int().nonnegative().describe("The number of the memory being placed."),
        name: memoryDocumentNameSchema.describe(
          "The name of the existing memory document this belongs in, or a new short kebab-case name when none covers it.",
        ),
      }),
    )
    .min(1),
});

export const memoryImportMessageSchema = z.object({
  text: z.string().min(1),
  createdAt: z.string().optional(),
});

export const memoryImportConversationSchema = z.object({
  title: z.string(),
  createdAt: z.string().optional(),
  messages: z.array(memoryImportMessageSchema).min(1),
});

export const createMemoryImportSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary"), text: z.string().trim().min(1) }),
  z.object({
    kind: z.literal("conversations"),
    source: memoryImportSourceSchema.exclude(["summary"]),
    conversations: z.array(memoryImportConversationSchema).min(1),
  }),
]);

export const memoryImportResponseSchema = z.object({
  importId: z.string(),
  taskId: z.string(),
  conversations: z.number().int().nonnegative(),
  messages: z.number().int().nonnegative(),
});

export const memoryImportExtractionSchema = z.object({
  memories: z.array(
    z.object({
      text: z
        .string()
        .trim()
        .min(1)
        .describe(
          "One lasting fact, preference, goal or commitment about the user, with the reason when the messages give one.",
        ),
      evidence: z
        .array(
          z.object({
            messageId: z.string().min(1).describe("The id of the message that shows this."),
            quote: z
              .string()
              .min(1)
              .describe("The exact words from that message, copied character for character."),
          }),
        )
        .min(1),
    }),
  ),
});

export const MEMORY_IMPORT_TASK_TYPE = "memory_import";
export const memoryImportTaskDataSchema = z.object({
  importId: z.string().min(1),
  source: memoryImportSourceSchema,
  key: z.string().min(1),
  offsets: z.array(z.number().int().nonnegative()).min(2),
  batch: z.number().int().nonnegative(),
});

export const memoryDocumentDraftSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1)
    .describe(
      "One line saying what this memory holds, specific enough to judge from an index whether it matters to a conversation.",
    ),
  type: memoryDocumentTypeSchema,
  content: z
    .string()
    .trim()
    .min(1)
    .max(MEMORY_DOCUMENT_MAX_CONTENT)
    .describe(
      "The whole memory document in Markdown: the fact or rule, then a **Why:** line and a **How to apply:** line, and [[name]] links to related memories.",
    ),
  changeNote: z.string().trim().min(1).describe("What changed, in one short sentence."),
});

export const MEMORY_REFLECTION_TASK_TYPE = "memory_reflection";
export const MEMORY_CONSOLIDATION_TASK_TYPE = "memory_consolidation";
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
        before: z.string(),
        after: z.string(),
        evidence: z
          .array(
            z.object({
              messageId: z.string().min(1),
              quote: z.string().min(1),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .max(20),
  changeNote: z.string().trim().min(1),
});
export type MemoryReflectionProposal = z.infer<typeof memoryReflectionProposalSchema>;

export type MemoryEvidence = z.infer<typeof memoryEvidenceSchema>;
export type MemoryImportSource = z.infer<typeof memoryImportSourceSchema>;
export type MemoryImportConversation = z.infer<typeof memoryImportConversationSchema>;
export type CreateMemoryImportInput = z.infer<typeof createMemoryImportSchema>;
export type MemoryImportResponse = z.infer<typeof memoryImportResponseSchema>;
export type MemoryImportExtraction = z.infer<typeof memoryImportExtractionSchema>;
export type MemoryImportTaskData = z.infer<typeof memoryImportTaskDataSchema>;
export type MemoryDocumentSummary = z.infer<typeof memoryDocumentSummarySchema>;
export type MemoryDocumentType = z.infer<typeof memoryDocumentTypeSchema>;
export type MemoryDocumentDraft = z.infer<typeof memoryDocumentDraftSchema>;
export type MemoryDocumentRevision = z.infer<typeof memoryDocumentRevisionSchema>;
export type MemoryDocumentScope = z.infer<typeof memoryDocumentScopeSchema>;
export type CreateMemoryDocumentInput = z.infer<typeof createMemoryDocumentSchema>;
export type UpdateMemoryDocumentInput = z.infer<typeof updateMemoryDocumentSchema>;

export function excerptMemoryDocument(content: string, limit = 220): string {
  const flattened = content.replace(/\s+/gu, " ").trim();

  return flattened.length > limit ? `${flattened.slice(0, limit)}…` : flattened;
}
