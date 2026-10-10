import z from "zod/v4";

import { modelTierSchema } from "./model-lineup.js";

export const AGENT_HOST_UNPROVISIONED_CODE = "agent_host_unprovisioned" as const;

export const agentHostIdSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,120}$/u, "Use lowercase letters, digits and hyphens");

export const agentHostRunIdSchema = z.string().regex(/^run_[a-f0-9]{32}$/u);

export const agentHostProvisionRequestSchema = z
  .object({
    hostId: agentHostIdSchema,
    apiKey: z.string().startsWith("ak_").min(8).max(256),
  })
  .strict();

export const agentHostRunRequestSchema = z
  .object({
    hostId: agentHostIdSchema,
    sessionId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,160}$/u)
      .describe("Hermes session that carries the conversation's history."),
    input: z.string().trim().min(1).max(100_000),
    modelTier: modelTierSchema,
  })
  .strict();

export const agentHostRunReferenceSchema = z
  .object({
    hostId: agentHostIdSchema,
    runId: agentHostRunIdSchema,
  })
  .strict();

export const agentHostApprovalRequestSchema = agentHostRunReferenceSchema
  .extend({
    choice: z.enum(["once", "deny"]),
    requestId: z.string().min(1).max(256).optional(),
  })
  .strict();

export const agentHostHostRequestSchema = z.object({ hostId: agentHostIdSchema }).strict();

export const agentHostRunStatusSchema = z.enum([
  "queued",
  "running",
  "stopping",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

export const AGENT_HOST_TERMINAL_RUN_STATUSES = [
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const satisfies readonly z.infer<typeof agentHostRunStatusSchema>[];

export const agentHostApprovalSchema = z
  .object({
    request_id: z.string().optional(),
    command: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export const agentHostRunSnapshotSchema = z
  .object({
    run_id: agentHostRunIdSchema,
    status: agentHostRunStatusSchema,
    output: z.string().optional(),
    error: z.string().optional(),
    approval: agentHostApprovalSchema.optional(),
  })
  .passthrough();

export const agentHostRunStartedSchema = z
  .object({
    run_id: agentHostRunIdSchema,
  })
  .passthrough();

export type AgentHostProvisionRequest = z.infer<typeof agentHostProvisionRequestSchema>;
export type AgentHostRunRequest = z.infer<typeof agentHostRunRequestSchema>;
export type AgentHostRunReference = z.infer<typeof agentHostRunReferenceSchema>;
export type AgentHostApprovalRequest = z.infer<typeof agentHostApprovalRequestSchema>;
export type AgentHostRunStatus = z.infer<typeof agentHostRunStatusSchema>;
export type AgentHostRunSnapshot = z.infer<typeof agentHostRunSnapshotSchema>;

export function isTerminalAgentHostRunStatus(status: AgentHostRunStatus): boolean {
  return (AGENT_HOST_TERMINAL_RUN_STATUSES as readonly string[]).includes(status);
}
