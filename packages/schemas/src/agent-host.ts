import z from "zod/v4";

import { sandboxNetworkHostSchema } from "./sandbox-environment.js";

export const AGENT_HOST_UNPROVISIONED_CODE = "agent_host_unprovisioned" as const;
export const AGENT_HOST_MAX_NETWORK_HOSTS = 32;

export const agentHostIdSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,120}$/u, "Use lowercase letters, digits and hyphens");

export const agentHostRunIdSchema = z.string().regex(/^run_[a-f0-9]{32}$/u);

export const agentHostNetworkHostsSchema = z
  .array(sandboxNetworkHostSchema)
  .max(AGENT_HOST_MAX_NETWORK_HOSTS)
  .default([]);

export const agentHostProvisionRequestSchema = z
  .object({
    hostId: agentHostIdSchema,
    serviceToken: z.string().min(1),
    networkHosts: agentHostNetworkHostsSchema.optional(),
  })
  .strict();

export const AGENT_HOST_MAX_INSTRUCTIONS_CHARS = 12_000;
export const AGENT_HOST_MAX_STEER_CHARS = 32_000;

export const agentHostReasoningEffortSchema = z
  .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"])
  .describe("Reasoning effort levels shared with the Hermes model gateway.");

export type AgentHostReasoningEffort = z.infer<typeof agentHostReasoningEffortSchema>;

export const agentHostIdempotencyKeySchema = z
  .string()
  .regex(/^[\x21-\x7E]{1,255}$/u, "Use a unique idempotency key per run")
  .describe("Retry key forwarded as Idempotency-Key so run creation is safely retryable.");

export const agentHostModelOptionsSchema = z
  .object({
    reasoning_effort: agentHostReasoningEffortSchema.optional(),
  })
  .passthrough()
  .describe("Per-run model controls forwarded to the Hermes model gateway.");

export const agentHostRunRequestSchema = z
  .object({
    hostId: agentHostIdSchema,
    sessionId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,160}$/u)
      .describe("Hermes session that carries the conversation's history."),
    input: z.string().trim().min(1).max(100_000).describe("The current message for this run."),
    instructions: z
      .string()
      .trim()
      .min(1)
      .max(AGENT_HOST_MAX_INSTRUCTIONS_CHARS)
      .optional()
      .describe("System instructions layered on top of the agent's core prompt."),
    idempotencyKey: agentHostIdempotencyKeySchema.optional(),
    model: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "Model id for this run, resolved through the host's Hermes provider. Omit to use the gateway default.",
      ),
    modelOptions: agentHostModelOptionsSchema.optional(),
  })
  .strict();

export const agentHostRunReferenceSchema = z
  .object({
    hostId: agentHostIdSchema,
    runId: agentHostRunIdSchema,
  })
  .strict();

export const agentHostSteerRequestSchema = agentHostRunReferenceSchema
  .extend({
    input: z
      .string()
      .trim()
      .min(1)
      .max(AGENT_HOST_MAX_STEER_CHARS)
      .describe("Guidance appended to the live run at the next tool boundary."),
  })
  .strict();

export const agentHostSteerResponseSchema = z
  .object({
    accepted: z.boolean(),
  })
  .passthrough();

export const agentHostApprovalRequestSchema = agentHostRunReferenceSchema
  .extend({
    choice: z.enum(["once", "deny"]),
    requestId: z.string().min(1).max(256).optional(),
  })
  .strict();

export const agentHostHostRequestSchema = z.object({ hostId: agentHostIdSchema }).strict();

export const agentHostDeprovisionRequestSchema = agentHostHostRequestSchema;

export const agentHostCheckpointRequestSchema = agentHostHostRequestSchema;

export const agentHostCheckpointResponseSchema = z
  .object({
    checkpointReference: z.string().min(1).nullable(),
  })
  .strict();

export const agentHostHealthResponseSchema = z
  .object({
    provisioned: z.boolean(),
    gateway: z.enum(["running", "stopped", "unknown"]),
  })
  .strict();

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

export const agentHostRunUsageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    cache_read_tokens: z.number().int().nonnegative().optional(),
    cache_write_tokens: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const agentHostRunRuntimeSchema = z
  .object({
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    route_source: z.string().min(1).optional(),
  })
  .passthrough();

export const agentHostRunSnapshotSchema = z
  .object({
    run_id: agentHostRunIdSchema,
    status: agentHostRunStatusSchema,
    session_id: z.string().optional(),
    output: z.string().optional(),
    error: z.string().optional(),
    approval: agentHostApprovalSchema.optional(),
    usage: agentHostRunUsageSchema.optional(),
    runtime: agentHostRunRuntimeSchema.optional(),
    pending_steer: z
      .string()
      .optional()
      .describe("Steer text the run never consumed, for replay as the next turn."),
  })
  .passthrough();

export const AGENT_HOST_RUN_TERMINAL_EVENTS = [
  "run.completed",
  "run.failed",
  "run.cancelled",
  "run.interrupted",
] as const;

export const agentHostRunEventNameSchema = z.enum([
  "message.delta",
  "message.interim",
  "tool.started",
  "tool.completed",
  "subagent.start",
  "subagent.complete",
  "approval.request",
  "run.steered",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "run.interrupted",
]);

export function isTerminalAgentHostRunEvent(event: string): boolean {
  return (AGENT_HOST_RUN_TERMINAL_EVENTS as readonly string[]).includes(event);
}

export const agentHostRunStartedSchema = z
  .object({
    run_id: agentHostRunIdSchema,
  })
  .passthrough();

export type AgentHostProvisionRequest = z.infer<typeof agentHostProvisionRequestSchema>;
export type AgentHostRunRequest = z.infer<typeof agentHostRunRequestSchema>;
export type AgentHostRunReference = z.infer<typeof agentHostRunReferenceSchema>;
export type AgentHostSteerRequest = z.infer<typeof agentHostSteerRequestSchema>;
export type AgentHostApprovalRequest = z.infer<typeof agentHostApprovalRequestSchema>;
export type AgentHostRunStatus = z.infer<typeof agentHostRunStatusSchema>;
export type AgentHostRunSnapshot = z.infer<typeof agentHostRunSnapshotSchema>;
export type AgentHostRunUsage = z.infer<typeof agentHostRunUsageSchema>;
export type AgentHostDeprovisionRequest = z.infer<typeof agentHostDeprovisionRequestSchema>;
export type AgentHostCheckpointRequest = z.infer<typeof agentHostCheckpointRequestSchema>;

export function isTerminalAgentHostRunStatus(status: AgentHostRunStatus): boolean {
  return (AGENT_HOST_TERMINAL_RUN_STATUSES as readonly string[]).includes(status);
}
