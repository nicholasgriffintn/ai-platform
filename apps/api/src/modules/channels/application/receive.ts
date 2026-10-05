import type { ChannelIncomingMessage, InboundChannelId } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, toSortableDecimalIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { parseChannelThreadAction } from "~/modules/channels/domain/controls";
import { toChannelBindingMessage } from "~/modules/channels/domain/messages";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { receiveChannelControl } from "./receive-control";
import { isChannelSenderAllowed } from "./thread-authority";

export async function receiveChannelMessage(
  context: ServiceContext,
  channel: InboundChannelId,
  incoming: ChannelIncomingMessage,
) {
  const binding = await context.repositories.channelBindings.findByExternalId(
    channel,
    incoming.externalId,
    incoming.workspaceId,
  );

  if (!binding?.enabled) {
    return { success: true, ignored: "unbound_channel" };
  }

  if (!isChannelSenderAllowed(binding, incoming.from)) {
    return { success: true, ignored: "unauthorised_sender" };
  }

  const user = await context.repositories.users.getUserById(binding.created_by);

  if (!user) {
    throw new AssistantError("Channel binding owner not found", ErrorType.NOT_FOUND);
  }

  const userContext = createServiceContext({
    env: context.env,
    user,
    requestId: context.requestId,
    waitUntil: context.waitUntil,
    executionCtx: context.executionCtx,
  });

  if (binding.scope_type === "project") {
    await requireProjectAccess(userContext, binding.scope_id);
  }

  const messageOrder = toSortableDecimalIdentifier(
    channel === "slack" ? incoming.messageId : `${incoming.messageId}.0`,
  );
  const reference = {
    bindingRevision: binding.revision,
    workspaceId: incoming.workspaceId,
    externalId: incoming.externalId,
    threadId: incoming.threadId,
  };
  const action = parseChannelThreadAction(incoming.body);

  if (action) {
    return receiveChannelControl({
      context: userContext,
      channel,
      incoming,
      binding,
      messageOrder,
      action,
    });
  }

  const thread = await context.repositories.channelThreads.admit({
    bindingId: binding.id,
    bindingRevision: binding.revision,
    threadId: incoming.threadId,
    messageOrder,
    activate: binding.reply_mode === "all" || incoming.mentioned || incoming.directMessage,
  });

  if (!thread) {
    return { success: true, ignored: "inactive_thread" };
  }

  const digest = await sha256Hex(canonicalJson([channel, binding.id, incoming.messageId]));
  const taskService = new TaskService(context.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    id: `inbound_message_${digest.slice(0, 40)}`,
    task_type: "inbound_message",
    user_id: user.id,
    schedule_type: "immediate",
    task_data: {
      channel,
      bindingId: binding.id,
      thread: { ...reference, revision: thread.revision },
      message: toChannelBindingMessage(incoming),
    },
    metadata: { source: "channel_webhook", channel, messageId: incoming.messageId },
  });

  return { success: true, taskId };
}
