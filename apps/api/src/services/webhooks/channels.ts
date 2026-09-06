import { INBOUND_CHANNEL_IDS, type InboundChannelId } from "@ngriffin_uk/polychat-schemas";
import type { Context } from "hono";

import { createServiceContext } from "~/lib/context/serviceContext";
import { getChannelAdapter } from "~/services/channels/adapters";
import { toChannelBindingMessage } from "~/services/channels/inbound";
import { getChannelSecrets } from "~/services/channels/secrets";
import { TaskService } from "~/services/tasks/TaskService";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/webhooks/channels" });

function isInboundChannelId(value: string): value is InboundChannelId {
  return (INBOUND_CHANNEL_IDS as readonly string[]).includes(value);
}

export async function handleChannelWebhook(c: Context): Promise<Response> {
  const channel = c.req.param("channel");

  if (!channel || !isInboundChannelId(channel)) {
    throw new AssistantError("Unknown channel webhook", ErrorType.NOT_FOUND);
  }

  const adapter = getChannelAdapter(channel);

  if (!adapter) {
    throw new AssistantError(`${channel} has no channel adapter`, ErrorType.NOT_FOUND);
  }

  const { verification } = getChannelSecrets(channel, c.env);

  if (!verification) {
    throw new AssistantError(
      `${adapter.label} webhooks are not configured on this deployment`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const rawBody = await c.req.text();
  const verified = await adapter.verify(c.req.raw, verification, rawBody);

  if (!verified.ok) {
    logger.warn("Refused an unverified channel webhook", {
      channel,
      reason: verified.reason,
    });

    throw new AssistantError(
      verified.reason ?? `${adapter.label} request could not be verified`,
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const incoming = adapter.parse(rawBody);

  if (incoming.kind === "control") {
    return c.json(incoming.response);
  }

  const context = createServiceContext({ env: c.env, requestId: c.get("requestId") });
  const binding = await context.repositories.channelBindings.getByExternalId(
    channel,
    incoming.externalId,
  );

  if (!binding) {
    logger.info("Ignored a message from a channel that is not connected", { channel });

    return c.json({ success: true, ignored: "unbound_channel" });
  }

  const user = await context.repositories.users.getUserById(binding.created_by);

  if (!user) {
    throw new AssistantError("Channel binding owner not found", ErrorType.NOT_FOUND);
  }

  const digest = await sha256Hex([channel, binding.id, incoming.messageId].join(":"));
  const taskService = new TaskService(c.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    id: `inbound_message_${digest.slice(0, 40)}`,
    task_type: "inbound_message",
    user_id: user.id,
    schedule_type: "immediate",
    task_data: {
      channel,
      bindingId: binding.id,
      message: toChannelBindingMessage(incoming),
    },
    metadata: {
      source: "channel_webhook",
      channel,
      messageId: incoming.messageId,
    },
  });

  return c.json({ success: true, taskId });
}
