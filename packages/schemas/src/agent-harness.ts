import z from "zod/v4";

import {
  chatCompletionMessageSchema,
  chatCompletionToolSchema,
  chatResponseFormatSchema,
  chatToolChoiceSchema,
} from "./engine-request.js";
import { permissionModeSchema, type PermissionMode } from "./providers.js";
import { reasoningEffortSchema } from "./reasoning.js";

export const AGENT_HARNESS_IDS = [
  "pi",
  "opencode",
  "hermes",
  "openai-agents",
  "bedrock-managed-agents",
] as const;
export const agentHarnessIdSchema = z.enum(AGENT_HARNESS_IDS);
export type AgentHarnessId = z.infer<typeof agentHarnessIdSchema>;

export const AGENT_HARNESS_PROVIDER = "agent-harness" as const;
export const AGENT_HARNESS_APPROVAL_TOOL = "request_approval" as const;

export const agentHarnessRuntimeSchema = z.enum(["worker", "container", "remote"]);
export type AgentHarnessRuntime = z.infer<typeof agentHarnessRuntimeSchema>;

export const agentHarnessCapabilitiesSchema = z
  .object({
    approvals: z.boolean(),
    steer: z.boolean(),
    fork: z.boolean(),
    workspaceTools: z.boolean(),
    ownsEnvironment: z.boolean(),
  })
  .strict();
export type AgentHarnessCapabilities = z.infer<typeof agentHarnessCapabilitiesSchema>;

export interface AgentHarnessDefinition {
  id: AgentHarnessId;
  name: string;
  description: string;
  runtime: AgentHarnessRuntime;
  capabilities: AgentHarnessCapabilities;
  permissionModes: PermissionMode[];
}

const GATED_PERMISSION_MODES: PermissionMode[] = ["supervised", "auto_accept_edits", "full_access"];

export const AGENT_HARNESS_DEFINITIONS: Record<AgentHarnessId, AgentHarnessDefinition> = {
  pi: {
    id: "pi",
    name: "Pi",
    description: "The Pi durable agent loop, steerable mid-run, with Polychat workspace tools.",
    runtime: "worker",
    capabilities: {
      approvals: true,
      steer: true,
      fork: true,
      workspaceTools: true,
      ownsEnvironment: false,
    },
    permissionModes: GATED_PERMISSION_MODES,
  },
  opencode: {
    id: "opencode",
    name: "OpenCode Cloud",
    description: "OpenCode 2 on Cloudflare, coding in a Polychat workspace.",
    runtime: "worker",
    capabilities: {
      approvals: true,
      steer: true,
      fork: true,
      workspaceTools: true,
      ownsEnvironment: false,
    },
    permissionModes: GATED_PERMISSION_MODES,
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    description: "Nous Research's agent with its own memory and skills, in its own container.",
    runtime: "container",
    capabilities: {
      approvals: false,
      steer: false,
      fork: true,
      workspaceTools: false,
      ownsEnvironment: true,
    },
    permissionModes: ["full_access"],
  },
  "openai-agents": {
    id: "openai-agents",
    name: "OpenAI Agents",
    description: "OpenAI's hosted agent sessions with their own environment.",
    runtime: "remote",
    capabilities: {
      approvals: true,
      steer: false,
      fork: false,
      workspaceTools: false,
      ownsEnvironment: true,
    },
    permissionModes: ["full_access"],
  },
  "bedrock-managed-agents": {
    id: "bedrock-managed-agents",
    name: "Bedrock Managed Agents",
    description: "AWS agent sessions on an AgentCore Runtime in your own AWS account.",
    runtime: "remote",
    capabilities: {
      approvals: false,
      steer: false,
      fork: false,
      workspaceTools: false,
      ownsEnvironment: true,
    },
    permissionModes: ["full_access"],
  },
};

export const agentHarnessSessionKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,160}$/u);

export const agentHarnessTurnRequestSchema = z
  .object({
    sessionKey: agentHarnessSessionKeySchema,
    userId: z.number().int().positive(),
    conversationId: z.string().trim().min(1).max(200),
    operationId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._~-]{1,120}$/u),
    input: z.string().trim().min(1),
    instructions: z.string().optional(),
    model: z.string().trim().min(1).max(200),
    reasoningEffort: reasoningEffortSchema.optional(),
    permissionMode: permissionModeSchema,
    whenBusy: z.enum(["followUp", "steer"]).default("followUp"),
  })
  .strict();
export type AgentHarnessTurnRequest = z.infer<typeof agentHarnessTurnRequestSchema>;

export const agentHarnessAnswerRequestSchema = z
  .object({
    sessionKey: agentHarnessSessionKeySchema,
    approvalId: z.string().trim().min(1).max(200),
    approved: z.boolean(),
    reason: z.string().max(2_000).optional(),
  })
  .strict();
export type AgentHarnessAnswerRequest = z.infer<typeof agentHarnessAnswerRequestSchema>;

export const agentHarnessAbortRequestSchema = z
  .object({
    sessionKey: agentHarnessSessionKeySchema,
    operationId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
export type AgentHarnessAbortRequest = z.infer<typeof agentHarnessAbortRequestSchema>;

export const agentHarnessEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text-delta"), partId: z.string(), delta: z.string() }),
  z.object({ type: z.literal("reasoning-delta"), partId: z.string(), delta: z.string() }),
  z.object({
    type: z.literal("tool-started"),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("tool-finished"),
    toolCallId: z.string(),
    toolName: z.string(),
    output: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal("approval-requested"),
    approvalId: z.string(),
    toolName: z.string(),
    description: z.string(),
    input: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("usage"),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("operation-settled"),
    operationId: z.string(),
    status: z.enum(["done", "unanswered"]),
    text: z.string().optional(),
    reason: z.string().optional(),
  }),
  z.object({ type: z.literal("diagnostic"), message: z.string() }),
]);
export type AgentHarnessEvent = z.infer<typeof agentHarnessEventSchema>;

export const agentHarnessEventRecordSchema = z
  .object({ seq: z.number().int().positive(), event: agentHarnessEventSchema })
  .strict();
export type AgentHarnessEventRecord = z.infer<typeof agentHarnessEventRecordSchema>;

export function isAgentHarnessId(value: unknown): value is AgentHarnessId {
  return agentHarnessIdSchema.safeParse(value).success;
}

export type RemoteAgentHarnessId = "openai-agents" | "bedrock-managed-agents";
export type HostedAgentHarnessId = Exclude<AgentHarnessId, RemoteAgentHarnessId>;

export function isHostedAgentHarness(harness: AgentHarnessId): harness is HostedAgentHarnessId {
  return AGENT_HARNESS_DEFINITIONS[harness].runtime !== "remote";
}

export interface AgentHarnessReceipt {
  operationId: string;
  accepted: boolean;
  after: number;
}

export interface AgentHarnessRpc {
  submitHarnessTurn(
    harness: HostedAgentHarnessId,
    request: AgentHarnessTurnRequest,
  ): Promise<AgentHarnessReceipt>;
  readHarnessEvents(
    harness: HostedAgentHarnessId,
    sessionKey: string,
    after: number,
  ): Promise<ReadableStream<Uint8Array>>;
  answerHarnessApproval(
    harness: HostedAgentHarnessId,
    request: AgentHarnessAnswerRequest,
  ): Promise<{ applied: boolean }>;
  abortHarnessTurn(harness: HostedAgentHarnessId, request: AgentHarnessAbortRequest): Promise<void>;
}

export const agentModelCompletionRequestSchema = z.object({
  model: z.string().trim().min(1).max(200),
  messages: z.array(chatCompletionMessageSchema).min(1),
  tools: z.array(chatCompletionToolSchema).optional(),
  tool_choice: chatToolChoiceSchema.optional(),
  parallel_tool_calls: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  reasoning_effort: reasoningEffortSchema.optional(),
  response_format: chatResponseFormatSchema.optional(),
  stream: z.boolean().optional(),
});
export type AgentModelCompletionRequest = z.infer<typeof agentModelCompletionRequestSchema>;

export const AGENT_HARNESS_TOOL_STREAM_TYPE = "polychat.agent_tool" as const;

export const agentHarnessToolStreamEventSchema = z.discriminatedUnion("phase", [
  z.object({
    type: z.literal(AGENT_HARNESS_TOOL_STREAM_TYPE),
    phase: z.literal("started"),
    toolCallId: z.string().min(1),
    toolName: z.string().min(1),
    input: z.unknown().optional(),
  }),
  z.object({
    type: z.literal(AGENT_HARNESS_TOOL_STREAM_TYPE),
    phase: z.literal("finished"),
    toolCallId: z.string().min(1),
    toolName: z.string().min(1),
    output: z.string().optional(),
    error: z.string().optional(),
  }),
]);
export type AgentHarnessToolStreamEvent = z.infer<typeof agentHarnessToolStreamEventSchema>;
