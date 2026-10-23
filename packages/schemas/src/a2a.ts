import z from "zod/v4";

export const A2A_PROTOCOL_VERSION = "0.3.0";

export const A2A_ERRORS = {
  taskNotFound: -32001,
  taskNotCancelable: -32002,
  pushNotificationNotSupported: -32003,
  unsupportedOperation: -32004,
  contentTypeNotSupported: -32005,
} as const;

export const A2A_TASK_STATES = [
  "submitted",
  "working",
  "input-required",
  "completed",
  "canceled",
  "failed",
  "rejected",
  "auth-required",
  "unknown",
] as const;

export const a2aTaskStateSchema = z.enum(A2A_TASK_STATES);

export const a2aPartSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("data"), data: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal("file"), file: z.record(z.string(), z.unknown()) }),
]);

export const a2aMessageSchema = z.object({
  kind: z.literal("message").default("message"),
  messageId: z.string().min(1).max(200),
  role: z.enum(["user", "agent"]),
  parts: z.array(a2aPartSchema).min(1).max(50),
  contextId: z.string().min(1).max(200).optional(),
  taskId: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const a2aSendMessageParamsSchema = z.object({
  message: a2aMessageSchema,
  configuration: z
    .object({ blocking: z.boolean().optional(), historyLength: z.number().int().min(0).optional() })
    .passthrough()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const a2aTaskIdParamsSchema = z.object({
  id: z.string().min(1).max(200),
  historyLength: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const a2aTaskStatusSchema = z.object({
  state: a2aTaskStateSchema,
  message: a2aMessageSchema.optional(),
  timestamp: z.string().optional(),
});

export const a2aArtifactSchema = z.object({
  artifactId: z.string().min(1),
  name: z.string().optional(),
  parts: z.array(a2aPartSchema),
});

export const a2aTaskSchema = z.object({
  kind: z.literal("task"),
  id: z.string().min(1),
  contextId: z.string().min(1),
  status: a2aTaskStatusSchema,
  artifacts: z.array(a2aArtifactSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const a2aTaskStatusUpdateEventSchema = z.object({
  kind: z.literal("status-update"),
  taskId: z.string().min(1),
  contextId: z.string().min(1),
  status: a2aTaskStatusSchema,
  final: z.boolean(),
});

export const a2aTaskArtifactUpdateEventSchema = z.object({
  kind: z.literal("artifact-update"),
  taskId: z.string().min(1),
  contextId: z.string().min(1),
  artifact: a2aArtifactSchema,
  append: z.boolean().optional(),
  lastChunk: z.boolean().optional(),
});

export const a2aAgentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
});

export const a2aAgentCardSchema = z.object({
  protocolVersion: z.literal(A2A_PROTOCOL_VERSION),
  name: z.string(),
  description: z.string(),
  url: z.url(),
  preferredTransport: z.literal("JSONRPC"),
  version: z.string(),
  iconUrl: z.string().optional(),
  provider: z.object({ organization: z.string(), url: z.url() }),
  capabilities: z.object({
    streaming: z.boolean(),
    pushNotifications: z.boolean(),
    stateTransitionHistory: z.boolean(),
  }),
  defaultInputModes: z.array(z.string()),
  defaultOutputModes: z.array(z.string()),
  skills: z.array(a2aAgentSkillSchema),
  securitySchemes: z.record(
    z.string(),
    z.object({ type: z.literal("http"), scheme: z.literal("bearer"), description: z.string() }),
  ),
  security: z.array(z.record(z.string(), z.array(z.string()))),
});

export type A2aPart = z.infer<typeof a2aPartSchema>;
export type A2aMessage = z.infer<typeof a2aMessageSchema>;
export type A2aSendMessageParams = z.infer<typeof a2aSendMessageParamsSchema>;
export type A2aTaskState = z.infer<typeof a2aTaskStateSchema>;
export type A2aTaskStatus = z.infer<typeof a2aTaskStatusSchema>;
export type A2aArtifact = z.infer<typeof a2aArtifactSchema>;
export type A2aTask = z.infer<typeof a2aTaskSchema>;
export type A2aTaskStatusUpdateEvent = z.infer<typeof a2aTaskStatusUpdateEventSchema>;
export type A2aTaskArtifactUpdateEvent = z.infer<typeof a2aTaskArtifactUpdateEventSchema>;
export type A2aAgentCard = z.infer<typeof a2aAgentCardSchema>;
