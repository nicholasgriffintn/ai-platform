import type { ChannelIncomingMessage, InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import type { ChannelThreadAction } from "~/modules/channels/domain/controls";

import { finishChannelControl } from "./finish-control";

export async function receiveChannelControl(params: {
  context: ServiceContext;
  channel: InboundChannelId;
  incoming: ChannelIncomingMessage;
  binding: ChannelBindingRow;
  messageOrder: string;
  action: ChannelThreadAction;
}) {
  const { context, channel, incoming, binding, messageOrder, action } = params;
  const updated = await context.repositories.channelThreads.control({
    bindingId: binding.id,
    bindingRevision: binding.revision,
    threadId: incoming.threadId,
    messageOrder,
    action,
  });
  const current =
    updated ?? (await context.repositories.channelThreads.get(binding.id, incoming.threadId));

  if (!current || current.last_control_order !== messageOrder) {
    return { success: true, ignored: "superseded_control" };
  }

  context.waitUntil(
    finishChannelControl({ context, channel, incoming, binding, current, action }).catch(() =>
      context
        .getLogger({ prefix: "channels/control" })
        .warn("Channel control acknowledgement did not complete"),
    ),
  );

  return { success: true, control: action };
}
