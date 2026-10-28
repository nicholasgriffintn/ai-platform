import {
  applyUsageRollup,
  buildInfraUsageDrafts,
  emitInfraUsage,
  emitUsageEvents,
  type UsageEventDraft,
  type UsageEventRecord,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import {
  usageQueueMessageSchema,
  type InfraUsageQueueMessage,
} from "~/modules/usage/domain/queue-messages";
import type { IEnv } from "~/types";

import { createUsageRuntime } from "./runtime";

const logger = getLogger({ prefix: "usage/infra-usage-queue" });

export async function meterRequestInfraUsage(
  env: IEnv,
  usage: Omit<InfraUsageQueueMessage, "kind">,
): Promise<void> {
  if (!env.USAGE_QUEUE) {
    await emitInfraUsage(createUsageRuntime({ env }), { ...usage, delivery: "inline" });

    return;
  }

  await env.USAGE_QUEUE.send({ kind: "infra_usage", ...usage } satisfies InfraUsageQueueMessage);
}

export async function rollUpUsageMessages(env: IEnv, messages: readonly Message[]): Promise<void> {
  const accepted: Message[] = [];
  const drafts: UsageEventDraft[] = [];
  const events: UsageEventRecord[] = [];

  for (const message of messages) {
    const parsed = usageQueueMessageSchema.safeParse(message.body);

    if (!parsed.success) {
      logger.warn("Dropped a malformed usage message", { id: message.id });
      message.ack();
      continue;
    }

    accepted.push(message);

    if (parsed.data.kind === "infra_usage") {
      drafts.push(...buildInfraUsageDrafts(parsed.data));
    } else {
      events.push(...parsed.data.events);
    }
  }

  const runtime = createUsageRuntime({ env });
  let failed = (await emitUsageEvents(runtime, { drafts, delivery: "inline" })) === "failed";

  if (events.length > 0) {
    try {
      await applyUsageRollup(runtime, events);
    } catch (error) {
      logger.error("Failed to roll up usage events", { error });
      failed = true;
    }
  }

  for (const message of accepted) {
    if (failed) {
      message.retry();
    } else {
      message.ack();
    }
  }
}
