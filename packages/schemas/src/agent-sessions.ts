import z from "zod/v4";

import { agentRuntimeVendorSchema } from "./desktop-runtimes.js";
import { permissionModeSchema } from "./providers.js";
import { reasoningEffortSchema } from "./reasoning.js";

export const AGENT_SESSION_PROTOCOL_VERSION = 1 as const;

export const agentModelSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string().max(400).nullable(),
    isDefault: z.boolean(),
    legacy: z.boolean(),
    reasoningEfforts: z.array(reasoningEffortSchema),
    defaultReasoningEffort: reasoningEffortSchema.nullable(),
  })
  .strict();

export type AgentModel = z.infer<typeof agentModelSchema>;

export const agentSessionCapabilitiesSchema = z
  .object({
    listsModels: z.boolean(),
    reportsApprovals: z.boolean(),
    resumesSessions: z.boolean(),
    streamsReasoning: z.boolean(),
    reportsUsage: z.boolean(),
    reportsDiffs: z.boolean(),
    rollsBack: z.boolean(),
    switchesModelInSession: z.boolean(),
  })
  .strict();

export type AgentSessionCapabilities = z.infer<typeof agentSessionCapabilitiesSchema>;

export const AGENT_APPROVAL_DECISIONS = [
  "accept",
  "accept_for_session",
  "decline",
  "cancel",
] as const;
export const agentApprovalDecisionSchema = z.enum(AGENT_APPROVAL_DECISIONS);
export type AgentApprovalDecision = z.infer<typeof agentApprovalDecisionSchema>;

export const AGENT_SESSION_APPROVAL_KINDS = [
  "command_execution",
  "file_change",
  "permissions",
  "tool_input",
  "unknown",
] as const;
export const agentSessionApprovalKindSchema = z.enum(AGENT_SESSION_APPROVAL_KINDS);
export type AgentSessionApprovalKind = z.infer<typeof agentSessionApprovalKindSchema>;

export const agentApprovalSchema = z
  .object({
    requestId: z.string().min(1),
    threadId: z.string().min(1),
    kind: agentSessionApprovalKindSchema,
    title: z.string().min(1).max(200),
    detail: z.string().max(8000).nullable(),
    command: z.string().max(4000).nullable(),
    cwd: z.string().max(1000).nullable(),
    decisions: z.array(agentApprovalDecisionSchema).min(1),
    requestedAt: z.string(),
  })
  .strict();

export type AgentApproval = z.infer<typeof agentApprovalSchema>;

export const agentItemStatusSchema = z.enum(["running", "completed", "failed"]);

const agentCommandItemSchema = z.object({
  kind: z.literal("command"),
  command: z.string(),
  output: z.string(),
  exitCode: z.number().int().nullable(),
});

const agentFileChangeItemSchema = z.object({
  kind: z.literal("file_change"),
  paths: z.array(z.string()).max(200),
  diff: z.string().nullable(),
});

const agentToolItemSchema = z.object({
  kind: z.literal("tool"),
  name: z.string(),
  detail: z.string().nullable(),
});

export const agentItemSchema = z
  .object({
    id: z.string().min(1),
    status: agentItemStatusSchema,
    body: z.discriminatedUnion("kind", [
      agentCommandItemSchema,
      agentFileChangeItemSchema,
      agentToolItemSchema,
    ]),
  })
  .strict();

export type AgentItem = z.infer<typeof agentItemSchema>;

export const agentTokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    cacheWriteInputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    reasoningOutputTokens: z.number().int().nonnegative(),
  })
  .strict();

export type AgentTokenUsage = z.infer<typeof agentTokenUsageSchema>;

export const agentSessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thread.started"),
    threadId: z.string().min(1),
    model: z.string().nullable(),
  }),
  z.object({ type: z.literal("turn.started"), turnId: z.string().min(1) }),
  z.object({
    type: z.literal("turn.completed"),
    turnId: z.string().min(1),
    usage: agentTokenUsageSchema.nullable(),
  }),
  z.object({ type: z.literal("turn.failed"), message: z.string().max(2000) }),
  z.object({ type: z.literal("message.delta"), delta: z.string() }),
  z.object({ type: z.literal("reasoning.delta"), delta: z.string() }),
  z.object({ type: z.literal("plan.updated"), text: z.string().max(20_000) }),
  z.object({ type: z.literal("item.updated"), item: agentItemSchema }),
  z.object({ type: z.literal("diff.updated"), diff: z.string().max(400_000) }),
  z.object({ type: z.literal("approval.requested"), approval: agentApprovalSchema }),
  z.object({ type: z.literal("approval.resolved"), requestId: z.string().min(1) }),
  z.object({ type: z.literal("usage.updated"), usage: agentTokenUsageSchema }),
  z.object({ type: z.literal("diagnostic"), message: z.string().max(2000) }),
  z.object({ type: z.literal("session.exited"), reason: z.string().max(400) }),
]);

export type AgentSessionEvent = z.infer<typeof agentSessionEventSchema>;

export const agentThreadBindingSchema = z
  .object({
    conversationId: z.string().min(1),
    driver: agentRuntimeVendorSchema,
    directoryId: z.string().min(1),
    threadId: z.string().min(1).nullable(),
    model: z.string().min(1).nullable(),
    reasoningEffort: reasoningEffortSchema.nullable(),
    permissionMode: permissionModeSchema,
    updatedAt: z.string(),
  })
  .strict();

export type AgentThreadBinding = z.infer<typeof agentThreadBindingSchema>;

export const agentTurnRequestSchema = z
  .object({
    conversationId: z.string().min(1),
    driver: agentRuntimeVendorSchema,
    directoryId: z.string().min(1),
    prompt: z.string().min(1),
    model: z.string().min(1).nullable(),
    reasoningEffort: reasoningEffortSchema.nullable(),
    permissionMode: permissionModeSchema,
  })
  .strict();

export type AgentTurnRequest = z.infer<typeof agentTurnRequestSchema>;

const BATCH_CAPABILITIES: AgentSessionCapabilities = {
  listsModels: false,
  reportsApprovals: false,
  resumesSessions: false,
  streamsReasoning: false,
  reportsUsage: false,
  reportsDiffs: false,
  rollsBack: false,
  switchesModelInSession: false,
};

const SESSION_CAPABILITIES: AgentSessionCapabilities = {
  listsModels: true,
  reportsApprovals: true,
  resumesSessions: true,
  streamsReasoning: true,
  reportsUsage: true,
  reportsDiffs: true,
  rollsBack: true,
  switchesModelInSession: true,
};

export function batchAgentCapabilities(): AgentSessionCapabilities {
  return { ...BATCH_CAPABILITIES };
}

export function sessionAgentCapabilities(): AgentSessionCapabilities {
  return { ...SESSION_CAPABILITIES };
}
