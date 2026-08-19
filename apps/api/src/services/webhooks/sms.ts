import type { Context } from "hono";

import { createServiceContext } from "~/lib/context/serviceContext";
import { isAuthorisedSender, isMessagingProviderId } from "~/lib/providers/capabilities/messaging";
import { resolveStoredMessagingProvider } from "~/lib/providers/capabilities/messaging/delivery";
import { toInboundChannelMessage } from "~/services/channels/inbound";
import { TaskService } from "~/services/tasks/TaskService";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/webhooks/sms" });

export async function handleSmsAssistantWebhook(c: Context): Promise<Response> {
  const providerId = c.req.param("providerId");
  const providerSettingsId = c.req.param("providerSettingsId");

  if (!providerId || !providerSettingsId || !isMessagingProviderId(providerId)) {
    throw new AssistantError("Invalid SMS webhook route", ErrorType.PARAMS_ERROR);
  }

  const baseContext = createServiceContext({ env: c.env, requestId: c.get("requestId") });
  const providerSettings = await baseContext.repositories.userSettings.getProviderSettingsById({
    providerId,
    providerSettingsId,
  });

  if (!providerSettings || !providerSettings.enabled) {
    throw new AssistantError("SMS provider is not configured", ErrorType.NOT_FOUND);
  }

  const user = await baseContext.repositories.users.getUserById(providerSettings.user_id);

  if (!user) {
    throw new AssistantError("SMS webhook user not found", ErrorType.NOT_FOUND);
  }

  const context = createServiceContext({
    env: c.env,
    user,
    requestId: c.get("requestId"),
  });
  const encryptedValue = await context.repositories.userSettings.getProviderApiKeyForSettings({
    userId: user.id,
    providerId,
    providerSettingsId,
  });

  if (!encryptedValue) {
    throw new AssistantError("SMS provider credentials are not configured", ErrorType.NOT_FOUND);
  }

  const { provider, allowedSenders } = resolveStoredMessagingProvider({
    providerId,
    value: encryptedValue,
    env: c.env,
    user,
    context,
  });
  const incoming = await provider.parseIncoming(c);

  if (incoming.kind === "control") {
    return c.json(incoming.response);
  }

  if (!isAuthorisedSender(allowedSenders, incoming.from)) {
    logger.warn("Ignored inbound SMS from an unauthorised sender", {
      providerId,
      providerSettingsId,
      userId: user.id,
    });

    return c.json({ success: true, ignored: "unauthorised_sender" });
  }

  const digest = await sha256Hex([providerId, providerSettingsId, incoming.messageId].join(":"));
  const taskService = new TaskService(c.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    id: `inbound_message_${digest.slice(0, 40)}`,
    task_type: "inbound_message",
    user_id: user.id,
    schedule_type: "immediate",
    task_data: {
      channel: "sms",
      providerId,
      providerSettingsId,
      message: toInboundChannelMessage(incoming),
    },
    metadata: {
      source: "sms_webhook",
      providerId,
      messageId: incoming.messageId,
    },
  });

  return c.json({ success: true, taskId });
}
