import z from "zod/v4";

import { isLoopbackUrl } from "./navigation.js";

export const DESKTOP_RUNTIME_PROTOCOL_VERSION = 1 as const;

export const DESKTOP_EXECUTION_LOCATIONS = ["device", "cloud"] as const;
export const desktopExecutionLocationSchema = z.enum(DESKTOP_EXECUTION_LOCATIONS);
export type DesktopExecutionLocation = z.infer<typeof desktopExecutionLocationSchema>;

export const DESKTOP_RUNTIME_KINDS = ["model", "agent"] as const;
export const desktopRuntimeKindSchema = z.enum(DESKTOP_RUNTIME_KINDS);
export type DesktopRuntimeKind = z.infer<typeof desktopRuntimeKindSchema>;

export const MODEL_RUNTIME_VENDORS = ["ollama", "lmstudio", "llamacpp"] as const;
export const modelRuntimeVendorSchema = z.enum(MODEL_RUNTIME_VENDORS);
export type ModelRuntimeVendor = z.infer<typeof modelRuntimeVendorSchema>;

export const AGENT_RUNTIME_VENDORS = ["openclaw", "hermes"] as const;
export const agentRuntimeVendorSchema = z.enum(AGENT_RUNTIME_VENDORS);
export type AgentRuntimeVendor = z.infer<typeof agentRuntimeVendorSchema>;

export const DESKTOP_ENDPOINT_TRANSPORTS = ["loopback", "network"] as const;
export const desktopEndpointTransportSchema = z.enum(DESKTOP_ENDPOINT_TRANSPORTS);
export type DesktopEndpointTransport = z.infer<typeof desktopEndpointTransportSchema>;

const desktopEndpointBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  url: z.string().min(1),
  transport: desktopEndpointTransportSchema,
  pairingSecretStored: z.boolean(),
  approvedAt: z.string(),
  lastSeenAt: z.string().nullable(),
});

export function isProtectedEndpointUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export function isSupportedEndpointUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

export const desktopEndpointSchema = z
  .discriminatedUnion("kind", [
    desktopEndpointBaseSchema.extend({
      kind: z.literal("model"),
      vendor: modelRuntimeVendorSchema,
    }),
    desktopEndpointBaseSchema.extend({
      kind: z.literal("agent"),
      vendor: agentRuntimeVendorSchema,
    }),
  ])
  .refine(
    (endpoint) => endpoint.transport !== "loopback" || isLoopbackUrl(endpoint.url),
    "A loopback endpoint must address a loopback host",
  )
  .refine((endpoint) => isSupportedEndpointUrl(endpoint.url), "An endpoint must use HTTP or HTTPS")
  .refine(
    (endpoint) =>
      endpoint.kind !== "agent" ||
      endpoint.transport !== "network" ||
      isProtectedEndpointUrl(endpoint.url) ||
      endpoint.pairingSecretStored,
    "A network agent runtime requires HTTPS or a stored pairing secret",
  );

export type DesktopEndpoint = z.infer<typeof desktopEndpointSchema>;

export type DesktopEndpointCandidate = Pick<
  DesktopEndpoint,
  "id" | "kind" | "vendor" | "label" | "url" | "transport"
> & {
  pairingSecret?: string;
};

export const desktopRuntimeReadinessSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    checkedAt: z.string(),
    version: z.string().nullable(),
    detail: z.string().max(400).nullable().optional(),
  }),
  z.object({
    status: z.literal("unreachable"),
    checkedAt: z.string(),
    detail: z.string().max(400).nullable(),
  }),
  z.object({
    status: z.literal("unauthorised"),
    checkedAt: z.string(),
    detail: z.string().max(400).nullable(),
  }),
]);

export type DesktopRuntimeReadiness = z.infer<typeof desktopRuntimeReadinessSchema>;

export const modelRuntimeCapabilitiesSchema = z.object({
  tools: z.boolean(),
  vision: z.boolean(),
  thinking: z.boolean(),
});

export const discoveredModelSchema = z.object({
  endpointId: z.string().min(1),
  nativeId: z.string().min(1),
  displayName: z.string().min(1),
  contextTokens: z.number().int().positive().nullable(),
  parameterSizeBytes: z.number().int().positive().nullable(),
  capabilities: modelRuntimeCapabilitiesSchema,
  loaded: z.boolean(),
  discoveredAt: z.string(),
});

export type DiscoveredModel = z.infer<typeof discoveredModelSchema>;

export const MODEL_RUNTIME_FAILURES = [
  "not-running",
  "model-not-found",
  "model-loading",
  "out-of-memory",
  "context-exceeded",
  "cancelled",
  "unknown",
] as const;
export const modelRuntimeFailureSchema = z.enum(MODEL_RUNTIME_FAILURES);
export type ModelRuntimeFailure = z.infer<typeof modelRuntimeFailureSchema>;

export const AGENT_RUNTIME_FAILURES = [
  "unreachable",
  "unauthorised",
  "session-gone",
  "permission-denied",
  "agent-error",
  "cancelled",
] as const;
export const agentRuntimeFailureSchema = z.enum(AGENT_RUNTIME_FAILURES);
export type AgentRuntimeFailure = z.infer<typeof agentRuntimeFailureSchema>;

export const agentRuntimeSessionSchema = z.object({
  endpointId: z.string().min(1),
  nativeId: z.string().min(1),
  title: z.string().max(200).nullable(),
  origin: z.string().max(80).nullable(),
  state: z.enum(["idle", "running", "awaiting-approval", "failed"]),
  executingHost: z.string().min(1),
  updatedAt: z.string(),
});

export type AgentRuntimeSession = z.infer<typeof agentRuntimeSessionSchema>;

export const AGENT_APPROVAL_KINDS = [
  "command",
  "file-write",
  "network",
  "tool",
  "unknown",
] as const;
export const agentApprovalKindSchema = z.enum(AGENT_APPROVAL_KINDS);

export const agentApprovalRequestSchema = z.object({
  id: z.string().min(1),
  sessionNativeId: z.string().min(1),
  kind: agentApprovalKindSchema,
  summary: z.string().min(1).max(200),
  detail: z.string().max(4000).nullable(),
  executingHost: z.string().min(1),
  requestedAt: z.string(),
});

export type AgentApprovalRequest = z.infer<typeof agentApprovalRequestSchema>;

export const agentApprovalDecisionSchema = z.object({
  requestId: z.string().min(1),
  approved: z.boolean(),
  decidedAt: z.string(),
});

export type AgentApprovalDecision = z.infer<typeof agentApprovalDecisionSchema>;

export const desktopSessionTokenSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export type DesktopSessionToken = z.infer<typeof desktopSessionTokenSchema>;

export const SIGNED_OUT_ACCOUNT = "device-only" as const;

export const localConversationSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  endpointId: z.string().min(1),
  nativeModelId: z.string().min(1),
  title: z.string().min(1).max(200),
  updatedAt: z.string(),
});

export type LocalConversation = z.infer<typeof localConversationSchema>;

export const localMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  status: z.enum(["complete", "interrupted"]),
  createdAt: z.string(),
});

export type LocalMessage = z.infer<typeof localMessageSchema>;

export const desktopModelRunRequestSchema = z.object({
  endpointId: z.string().min(1),
  nativeModelId: z.string().min(1),
  conversationId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  maxOutputTokens: z.number().int().positive().nullable(),
});

export type DesktopModelRunRequest = z.infer<typeof desktopModelRunRequestSchema>;

export const desktopAgentRunRequestSchema = z.object({
  endpointId: z.string().min(1),
  sessionNativeId: z.string().min(1).nullable(),
  conversationId: z.string().min(1),
  prompt: z.string().min(1),
});

export type DesktopAgentRunRequest = z.infer<typeof desktopAgentRunRequestSchema>;

export const desktopRunProgressSchema = z.enum(["queued", "loading-model", "generating"]);
export type DesktopRunProgress = z.infer<typeof desktopRunProgressSchema>;

export const desktopStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    runId: z.string().min(1),
    endpointId: z.string().min(1),
    at: z.string(),
  }),
  z.object({
    type: z.literal("progress"),
    runId: z.string().min(1),
    state: desktopRunProgressSchema,
  }),
  z.object({
    type: z.literal("text"),
    runId: z.string().min(1),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("reasoning"),
    runId: z.string().min(1),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("approval-required"),
    runId: z.string().min(1),
    request: agentApprovalRequestSchema,
  }),
  z.object({
    type: z.literal("usage"),
    runId: z.string().min(1),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
  }),
  z.object({
    type: z.literal("failed"),
    runId: z.string().min(1),
    failure: z.union([modelRuntimeFailureSchema, agentRuntimeFailureSchema]),
    message: z.string().max(400),
  }),
  z.object({
    type: z.literal("finished"),
    runId: z.string().min(1),
    reason: z.enum(["complete", "cancelled", "interrupted"]),
    at: z.string(),
  }),
]);

export type DesktopStreamEvent = z.infer<typeof desktopStreamEventSchema>;

export const desktopRuntimeEnvelopeSchema = z.object({
  protocolVersion: z.literal(DESKTOP_RUNTIME_PROTOCOL_VERSION),
  event: desktopStreamEventSchema,
});

export type DesktopRuntimeEnvelope = z.infer<typeof desktopRuntimeEnvelopeSchema>;
