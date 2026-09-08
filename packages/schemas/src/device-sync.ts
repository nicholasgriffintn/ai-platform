import z from "zod/v4";

export const DEVICE_SYNC_PROTOCOL_VERSION = 1 as const;
export const DEVICE_SYNC_EVENT_RETENTION_LIMIT = 500 as const;
export const DEVICE_SYNC_GRANT_TTL_SECONDS = 60 as const;
export const DEVICE_SYNC_COALESCE_WINDOW_MS = 50 as const;
export const DEVICE_SYNC_MAX_TOPICS_PER_CONNECTION = 32 as const;

export const deviceSyncTopicKindSchema = z.enum([
  "user",
  "conversation",
  "project",
  "workspace",
  "run",
  "machine",
]);

export type DeviceSyncTopicKind = z.infer<typeof deviceSyncTopicKindSchema>;

const TOPIC_PATTERN = /^(user|conversation|project|workspace|run|machine):[A-Za-z0-9_.:-]{1,200}$/;

export const deviceSyncTopicSchema = z.string().regex(TOPIC_PATTERN, "Invalid sync topic");

export type DeviceSyncTopic = z.infer<typeof deviceSyncTopicSchema>;

export function buildDeviceSyncTopic(kind: DeviceSyncTopicKind, id: string | number): string {
  return `${kind}:${id}`;
}

export function parseDeviceSyncTopic(
  topic: string,
): { kind: DeviceSyncTopicKind; id: string } | null {
  const separator = topic.indexOf(":");

  if (separator <= 0) {
    return null;
  }

  const kind = deviceSyncTopicKindSchema.safeParse(topic.slice(0, separator));

  if (!kind.success) {
    return null;
  }

  const id = topic.slice(separator + 1);

  return id ? { kind: kind.data, id } : null;
}

export const deviceSyncEventTypeSchema = z.enum([
  "conversation.changed",
  "conversation.deleted",
  "conversation.unread_changed",
  "run.changed",
  "run.event",
  "message.changed",
  "delegation.changed",
  "task.changed",
  "project_task.changed",
  "workbench_run.changed",
  "workbench_preview.changed",
  "machine.changed",
  "usage.changed",
  "goal.changed",
  "research.changed",
  "training.changed",
  "canvas.changed",
  "replicate.changed",
  "connector_approval.changed",
  "attention.changed",
  "presence.changed",
]);

export type DeviceSyncEventType = z.infer<typeof deviceSyncEventTypeSchema>;

export const deviceSyncEventSchema = z.object({
  v: z.literal(DEVICE_SYNC_PROTOCOL_VERSION),
  topic: deviceSyncTopicSchema,
  seq: z.number().int().positive(),
  at: z.string(),
  type: deviceSyncEventTypeSchema,
  originDeviceId: z.string().min(1).nullable().default(null),
  data: z.record(z.string(), z.unknown()),
});

export type DeviceSyncEvent = z.infer<typeof deviceSyncEventSchema>;

export const deviceSyncPublishSchema = z.object({
  topic: deviceSyncTopicSchema,
  type: deviceSyncEventTypeSchema,
  originDeviceId: z.string().min(1).nullable().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type DeviceSyncPublish = z.infer<typeof deviceSyncPublishSchema>;

export const deviceSyncSubscriptionSchema = z.object({
  topic: deviceSyncTopicSchema,
  lastSeq: z.number().int().nonnegative().default(0),
});

export type DeviceSyncSubscription = z.infer<typeof deviceSyncSubscriptionSchema>;

export const deviceSyncClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    topics: z.array(deviceSyncSubscriptionSchema).min(1).max(DEVICE_SYNC_MAX_TOPICS_PER_CONNECTION),
  }),
  z.object({
    type: z.literal("unsubscribe"),
    topics: z.array(deviceSyncTopicSchema).min(1),
  }),
  z.object({
    type: z.literal("focus"),
    topic: deviceSyncTopicSchema.nullable(),
  }),
  z.object({ type: z.literal("ping") }),
]);

export type DeviceSyncClientMessage = z.infer<typeof deviceSyncClientMessageSchema>;

export const deviceSyncPresenceEntrySchema = z.object({
  deviceId: z.string().min(1),
  focusedTopic: deviceSyncTopicSchema.nullable(),
  connectedAt: z.string(),
});

export type DeviceSyncPresenceEntry = z.infer<typeof deviceSyncPresenceEntrySchema>;

export const deviceSyncServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    deviceId: z.string().min(1),
    protocolVersion: z.literal(DEVICE_SYNC_PROTOCOL_VERSION),
    at: z.string(),
  }),
  z.object({
    type: z.literal("subscribed"),
    topic: deviceSyncTopicSchema,
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("event"),
    event: deviceSyncEventSchema,
  }),
  z.object({
    type: z.literal("reset"),
    topic: deviceSyncTopicSchema,
    seq: z.number().int().nonnegative(),
    reason: z.enum(["gap", "retention", "overflow", "unauthorised"]),
  }),
  z.object({
    type: z.literal("presence"),
    topic: deviceSyncTopicSchema,
    devices: z.array(deviceSyncPresenceEntrySchema),
  }),
  z.object({ type: z.literal("pong") }),
]);

export type DeviceSyncServerMessage = z.infer<typeof deviceSyncServerMessageSchema>;

export const deviceSyncGrantRequestSchema = z.object({
  deviceId: z.string().trim().min(1).max(200),
});

export type DeviceSyncGrantRequest = z.infer<typeof deviceSyncGrantRequestSchema>;

export const deviceSyncGrantResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number().int().positive(),
  socketUrl: z.string().min(1),
});

export type DeviceSyncGrantResponse = z.infer<typeof deviceSyncGrantResponseSchema>;

export const deviceSyncSocketQuerySchema = z.object({
  grant: z.string().trim().min(1),
  device_id: z.string().trim().min(1).max(200),
});

export type DeviceSyncSocketQuery = z.infer<typeof deviceSyncSocketQuerySchema>;
