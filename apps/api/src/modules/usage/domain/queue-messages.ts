import type { UsageEventRecord } from "@ngriffin_uk/polychat-ai-billing";
import { usageUnitSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { z } from "zod/v4";

export const infraUsageQueueMessageSchema = z.object({
  kind: z.literal("infra_usage"),
  userId: z.number().int().positive(),
  scopeKey: z.string().min(1),
  occurredAt: z.string().min(1),
  quantities: z.array(z.object({ unit: usageUnitSchema, quantity: z.number() })),
});

export const usageEventsQueueMessageSchema = z.object({
  kind: z.literal("usage_events"),
  events: z.array(z.custom<UsageEventRecord>(isRecord)).min(1),
});

export const usageQueueMessageSchema = z.discriminatedUnion("kind", [
  infraUsageQueueMessageSchema,
  usageEventsQueueMessageSchema,
]);

export type InfraUsageQueueMessage = z.infer<typeof infraUsageQueueMessageSchema>;
export type UsageQueueMessage = z.infer<typeof usageQueueMessageSchema>;

const USAGE_QUEUE_MESSAGE_KINDS = new Set<unknown>(["infra_usage", "usage_events"]);

export function isUsageQueueMessage<T extends object>(
  body: T | UsageQueueMessage,
): body is UsageQueueMessage {
  return "kind" in body && USAGE_QUEUE_MESSAGE_KINDS.has(body.kind);
}
