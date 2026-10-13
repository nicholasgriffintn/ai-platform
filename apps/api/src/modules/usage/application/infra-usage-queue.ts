import {
  buildInfraUsageDrafts,
  emitInfraUsage,
  emitUsageEvents,
  type UsageEventDraft,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { usageUnitSchema } from "@ngriffin_uk/polychat-schemas";
import { z } from "zod/v4";

import type { IEnv } from "~/types";

import { createUsageRuntime } from "./runtime";

const logger = getLogger({ prefix: "usage/infra-usage-queue" });

const INFRA_USAGE_QUEUE_MESSAGE_KIND = "infra_usage";

const infraUsageQueueMessageSchema = z.object({
  kind: z.literal(INFRA_USAGE_QUEUE_MESSAGE_KIND),
  userId: z.number().int().positive(),
  scopeKey: z.string().min(1),
  occurredAt: z.string().min(1),
  quantities: z.array(z.object({ unit: usageUnitSchema, quantity: z.number() })),
});

export type InfraUsageQueueMessage = z.infer<typeof infraUsageQueueMessageSchema>;

export function isInfraUsageQueueMessage<T extends object>(
  body: T | InfraUsageQueueMessage,
): body is InfraUsageQueueMessage {
  return "kind" in body && body.kind === INFRA_USAGE_QUEUE_MESSAGE_KIND;
}

export async function meterRequestInfraUsage(
  env: IEnv,
  usage: Omit<InfraUsageQueueMessage, "kind">,
): Promise<void> {
  if (!env.TASK_QUEUE) {
    await emitInfraUsage(createUsageRuntime({ env }), { ...usage, delivery: "inline" });

    return;
  }

  await env.TASK_QUEUE.send({ kind: INFRA_USAGE_QUEUE_MESSAGE_KIND, ...usage });
}

export async function rollUpInfraUsageMessages(
  env: IEnv,
  messages: readonly Message[],
): Promise<void> {
  const accepted: Message[] = [];
  const drafts: UsageEventDraft[] = [];

  for (const message of messages) {
    const parsed = infraUsageQueueMessageSchema.safeParse(message.body);

    if (!parsed.success) {
      logger.warn("Dropped a malformed infrastructure usage message", { id: message.id });
      message.ack();
      continue;
    }

    accepted.push(message);
    drafts.push(...buildInfraUsageDrafts(parsed.data));
  }

  const outcome = await emitUsageEvents(createUsageRuntime({ env }), {
    drafts,
    delivery: "inline",
  });

  for (const message of accepted) {
    if (outcome === "failed") {
      message.retry();
    } else {
      message.ack();
    }
  }
}
