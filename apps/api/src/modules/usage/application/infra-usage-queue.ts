import {
  aggregateInfraUsage,
  applyUsageRollup,
  buildInfraUsageDrafts,
  emitInfraUsage,
  emitUsageEvents,
  type UsageEventRecord,
  type UsageRuntime,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { groupBy } from "@ngriffin_uk/polychat-utility-core";

import { isD1WriteBreakerOpen } from "~/modules/infra/application/write-breaker";
import {
  usageQueueMessageSchema,
  type InfraUsageQueueMessage,
} from "~/modules/usage/domain/queue-messages";
import type { IEnv } from "~/types";

import { createUsageRuntime } from "./runtime";

const logger = getLogger({ prefix: "usage/infra-usage-queue" });

interface QueuedInfraMessage {
  message: Message;
  usage: InfraUsageQueueMessage;
}

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

function settleMessages(messages: readonly Message[], failed: boolean): void {
  for (const message of messages) {
    if (failed) {
      message.retry();
    } else {
      message.ack();
    }
  }
}

async function rollUpInfraMessages(
  env: IEnv,
  runtime: UsageRuntime,
  entries: readonly QueuedInfraMessage[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  if (await isD1WriteBreakerOpen(env)) {
    logger.warn("Shed per-request infrastructure usage", { count: entries.length });
    settleMessages(
      entries.map((entry) => entry.message),
      false,
    );

    return;
  }

  for (const group of groupBy(entries, (entry) => entry.usage.userId).values()) {
    const usages = await aggregateInfraUsage(group.map((entry) => entry.usage));
    const outcome = await emitUsageEvents(runtime, {
      drafts: usages.flatMap((usage) => buildInfraUsageDrafts(usage)),
      delivery: "inline",
    });

    settleMessages(
      group.map((entry) => entry.message),
      outcome === "failed",
    );
  }
}

export async function rollUpUsageMessages(env: IEnv, messages: readonly Message[]): Promise<void> {
  const infraMessages: QueuedInfraMessage[] = [];
  const eventMessages: Message[] = [];
  const events: UsageEventRecord[] = [];

  for (const message of messages) {
    const parsed = usageQueueMessageSchema.safeParse(message.body);

    if (!parsed.success) {
      logger.warn("Dropped a malformed usage message", { id: message.id });
      message.ack();
      continue;
    }

    if (parsed.data.kind === "infra_usage") {
      infraMessages.push({ message, usage: parsed.data });
    } else {
      eventMessages.push(message);
      events.push(...parsed.data.events);
    }
  }

  const runtime = createUsageRuntime({ env });

  await rollUpInfraMessages(env, runtime, infraMessages);

  if (events.length === 0) {
    return;
  }

  let failed = false;

  try {
    await applyUsageRollup(runtime, events);
  } catch (error) {
    logger.error("Failed to roll up usage events", { error });
    failed = true;
  }

  settleMessages(eventMessages, failed);
}
