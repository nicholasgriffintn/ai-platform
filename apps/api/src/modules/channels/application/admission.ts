import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { toChannelBindingMessage } from "./inbound";
import type { ChannelIncomingMessage } from "./ports/channel-adapter";
import { consumeChannelPairingCommand } from "./senders";

const logger = getLogger({ prefix: "services/channels/admission" });

export type ChannelAdmission =
  | { status: "linked"; linked: boolean }
  | { status: "ignored"; reason: "unbound_channel" | "unverified_sender" }
  | { status: "queued"; taskId: string };

export async function admitChannelMessage(params: {
  env: IEnv;
  context: ServiceContext;
  channel: InboundChannelId;
  incoming: ChannelIncomingMessage;
  source: string;
}): Promise<ChannelAdmission> {
  const { channel, context, incoming } = params;
  const linked = await consumeChannelPairingCommand(context, incoming);

  if (linked !== null) {
    return { status: "linked", linked };
  }

  const binding = await context.repositories.channelBindings.getByExternalId(
    channel,
    incoming.externalId,
  );

  if (!binding) {
    logger.info("Ignored a message from a channel that is not connected", { channel });

    return { status: "ignored", reason: "unbound_channel" };
  }

  const sender = await context.repositories.channelSenders.eligibleSender(
    binding.id,
    incoming.from,
    incoming.context.isDirect,
  );

  if (!sender) {
    return { status: "ignored", reason: "unverified_sender" };
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
  const taskService = new TaskService(params.env, context.repositories.tasks);
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
      source: params.source,
      channel,
      messageId: incoming.messageId,
    },
  });

  return { status: "queued", taskId };
}
