import { extractChatCompletionNotification } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { TeammateInvocation } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { CHANNEL_TOP_LEVEL_THREAD } from "~/modules/channels/application/ports/channel-adapter";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";

import { requireChannelSenderMapping } from "./access";

const logger = getLogger({ prefix: "services/channels/follow-up" });

export type ChannelInvocation = Extract<TeammateInvocation, { source: "channel" }>;

export async function deliverChannelFollowUp(params: {
  context: ServiceContext;
  invocation: ChannelInvocation;
  operationId: string;
  completion: Parameters<typeof extractChatCompletionNotification>[0];
}): Promise<"delivered" | "skipped"> {
  const { context, invocation } = params;

  try {
    const { binding } = await requireChannelSenderMapping(context, {
      bindingId: invocation.bindingId,
      mappingId: invocation.senderMappingId,
      revision: invocation.senderRevision,
    });
    const adapter = getChannelAdapter(binding.channel);

    if (!adapter?.isReplyConfigured(context.env)) {
      return "skipped";
    }

    const notification = extractChatCompletionNotification(params.completion, {
      streamingMessage: `${adapter.label} follow-ups cannot be streamed`,
    });

    if (!notification.body.trim()) {
      return "skipped";
    }

    const digest = await sha256Hex(`${params.operationId}:${binding.id}`);

    await deliverOutboundOperation({
      context,
      deliveryId: `channel_follow_up_${digest.slice(0, 40)}`,
      userId: context.requireUser().id,
      kind: "channel_reply",
      scopeId: binding.id,
      operationId: params.operationId,
      payload: { bindingId: binding.id, threadId: invocation.threadId, body: notification.body },
      send: () =>
        adapter.sendReply(
          {
            externalId: binding.external_id,
            body: notification.body,
            threadId: invocation.threadId ?? CHANNEL_TOP_LEVEL_THREAD,
            inReplyTo: invocation.messageId,
            ...(invocation.subject ? { subject: invocation.subject } : {}),
          },
          context.env,
        ),
    });

    return "delivered";
  } catch (error) {
    logger.warn("Could not report back to the originating channel thread", {
      bindingId: invocation.bindingId,
      operationId: params.operationId,
      error: getErrorMessage(error),
    });

    return "skipped";
  }
}
