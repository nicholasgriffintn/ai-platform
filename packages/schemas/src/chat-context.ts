import z from "zod/v4";

export const CHAT_CONTEXT_PROTOCOL_VERSION = 1 as const;

export const chatContextUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  contextWindow: z.number().int().positive(),
  source: z.enum(["reported", "estimated"]),
});

export const chatContextSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["included", "omitted", "unavailable"]),
  retrievalPath: z.string().min(1).nullable(),
  messageId: z.string().min(1).nullable(),
});

export const chatContextSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  state: z.enum(["available", "loaded"]),
  revision: z.number().int().positive().optional(),
});

export const chatContextApprovalSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["approval", "question"]),
  status: z.enum(["pending", "approved", "rejected", "resolved", "expired", "interrupted"]),
  toolName: z.string().min(1).nullable(),
  messageId: z.string().min(1).nullable(),
});

export const chatContextSummarySchema = z.object({
  messageId: z.string().min(1),
  status: z.enum(["included", "omitted"]),
  text: z.string().max(16000),
  representedMessageCount: z.number().int().nonnegative(),
  candidateMessageCount: z.number().int().nonnegative(),
  fallback: z.boolean(),
});

export const chatContextOmissionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["history", "tool_result", "source"]),
  reason: z.enum(["context_window", "bounded", "unavailable"]),
  count: z.number().int().positive(),
  messageId: z.string().min(1).nullable(),
  retrievalPath: z.string().min(1).nullable(),
});

export const chatContextSnapshotSchema = z.object({
  protocolVersion: z.literal(CHAT_CONTEXT_PROTOCOL_VERSION),
  runId: z.string().min(1),
  conversationId: z.string().min(1),
  attempt: z.number().int().positive(),
  step: z.number().int().positive(),
  model: z.string().min(1),
  provider: z.string().min(1).optional(),
  generatedAt: z.string(),
  usage: chatContextUsageSchema,
  messages: z.object({
    included: z.number().int().nonnegative(),
    omitted: z.number().int().nonnegative(),
  }),
  sources: z.array(chatContextSourceSchema),
  skills: z.array(chatContextSkillSchema),
  approvals: z.array(chatContextApprovalSchema).optional(),
  summary: chatContextSummarySchema.nullable(),
  omissions: z.array(chatContextOmissionSchema),
});

export type ChatContextUsage = z.infer<typeof chatContextUsageSchema>;
export type ChatContextSource = z.infer<typeof chatContextSourceSchema>;
export type ChatContextSkill = z.infer<typeof chatContextSkillSchema>;
export type ChatContextApproval = z.infer<typeof chatContextApprovalSchema>;
export type ChatContextSummary = z.infer<typeof chatContextSummarySchema>;
export type ChatContextOmission = z.infer<typeof chatContextOmissionSchema>;
export type ChatContextSnapshot = z.infer<typeof chatContextSnapshotSchema>;
