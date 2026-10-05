import type { ChannelIncomingMessage, InboundChannelId } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow, ChannelThreadRow } from "~/infrastructure/database/schema";
import type { ChannelThreadAction } from "~/modules/channels/domain/controls";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";

import { getChannelBindingConversationId } from "./conversation-identity";
import { getChannelSecrets } from "./secrets";
import { isChannelSenderAllowed } from "./thread-authority";
import { cancelChannelThreadRun } from "./thread-controls";

export async function finishChannelControl(params: {
  context: ServiceContext;
  channel: InboundChannelId;
  incoming: ChannelIncomingMessage;
  binding: ChannelBindingRow;
  current: ChannelThreadRow;
  action: ChannelThreadAction;
}): Promise<void> {
  const { context, channel, incoming, binding, current, action } = params;
  const userId = context.requireUser().id;
  const conversationId = await getChannelBindingConversationId({
    channel,
    bindingId: binding.id,
    thread: {
      workspaceId: incoming.workspaceId,
      externalId: incoming.externalId,
      threadId: incoming.threadId,
    },
  });

  if (action !== "resume") {
    await cancelChannelThreadRun({
      context,
      conversationId,
      userId: userId,
      revision: current.revision,
    });
  }

  const adapter = getChannelAdapter(channel);
  const { reply } = getChannelSecrets(channel, context.env);
  const body =
    action === "mute"
      ? "This thread is muted. Send ‘polychat resume’ in this thread to resume replies."
      : action === "stop"
        ? "Stopped the current response in this thread."
        : "Replies resumed in this thread.";

  if (adapter && reply) {
    const digest = await sha256Hex(
      canonicalJson([channel, binding.id, incoming.messageId, action]),
    );

    await deliverOutboundOperation({
      context,
      deliveryId: `channel_control_${digest.slice(0, 40)}`,
      userId: userId,
      kind: "channel_reply",
      scopeId: conversationId,
      operationId: incoming.messageId,
      payload: { destination: incoming.externalId, threadId: incoming.threadId, body },
      send: async () => {
        const latest = await context.repositories.channelThreads.get(binding.id, incoming.threadId);
        const liveBinding = await context.repositories.channelBindings.getById(binding.id);

        if (
          !latest ||
          latest.revision !== current.revision ||
          !liveBinding?.enabled ||
          liveBinding.revision !== binding.revision ||
          liveBinding.workspace_id !== binding.workspace_id ||
          liveBinding.external_id !== binding.external_id ||
          liveBinding.created_by !== binding.created_by ||
          !isChannelSenderAllowed(liveBinding, incoming.from)
        ) {
          throw new AssistantError(
            "Channel control changed before acknowledgement",
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }

        await adapter.sendReply(
          { externalId: incoming.externalId, threadId: incoming.threadId, body },
          reply,
        );
      },
    });
  }
}
