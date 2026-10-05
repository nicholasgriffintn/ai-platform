import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { inboundChannelIdSchema } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type { Context } from "hono";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { toChannelBindingMessage } from "~/modules/channels/application/inbound";
import { getChannelSecrets } from "~/modules/channels/application/secrets";
import { consumeChannelPairingCommand } from "~/modules/channels/application/senders";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { TaskService } from "~/modules/tasks/application/TaskService";

const logger = getLogger({ prefix: "services/webhooks/channels" });

export async function handleChannelWebhook(c: Context): Promise<Response> {
  const parsedChannel = inboundChannelIdSchema.safeParse(c.req.param("channel"));

  if (!parsedChannel.success) {
    throw new AssistantError("Unknown channel webhook", ErrorType.NOT_FOUND);
  }

  const channel = parsedChannel.data;

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
  const linked = await consumeChannelPairingCommand(context, incoming);

  if (linked !== null) {
    return c.json({ success: true, linked });
  }

  const binding = await context.repositories.channelBindings.getByExternalId(
    channel,
    incoming.externalId,
  );

  if (!binding) {
    logger.info("Ignored a message from a channel that is not connected", { channel });

    return c.json({ success: true, ignored: "unbound_channel" });
  }

  const sender = await context.repositories.channelSenders.eligibleSender(
    binding.id,
    incoming.from,
    incoming.context.isDirect,
  );

  if (!sender) {
    return c.json({ success: true, ignored: "unverified_sender" });
  }

  const user = await context.repositories.users.getUserById(sender.user_id);

  if (!user) {
    throw new AssistantError("Channel binding owner not found", ErrorType.NOT_FOUND);
  }

  const digest = await sha256Hex(
    JSON.stringify([
      channel,
      binding.id,
      sender.id,
      sender.revision,
      incoming.context.threadId,
      incoming.messageId,
    ]),
  );
  const taskService = new TaskService(c.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    id: `inbound_message_${digest.slice(0, 40)}`,
    task_type: "inbound_message",
    user_id: user.id,
    schedule_type: "immediate",
    task_data: {
      channel,
      bindingId: binding.id,
      senderMappingId: sender.id,
      senderRevision: sender.revision,
      messageContext: incoming.context,
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
