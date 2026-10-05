import {
  buildInboundMessageContent,
  extractChatCompletionNotification,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  createChatCompletionsJsonSchema,
  type InboundChannelTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ChannelDeliveryChangedError } from "~/modules/channels/domain/errors";
import { isInboundBindingTaskData } from "~/modules/channels/domain/messages";
import { recoverChatCompletionResponse } from "~/modules/chat-runs/application/completion-recovery";
import { getInboundChannelProfile } from "~/modules/chat/domain/channels";
import { handleCreateChatCompletions } from "~/modules/completions/application/createChatCompletions";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";
import { enqueueTeammateRun } from "~/modules/teammates/application/run-admission";
import type { IEnv, IUser } from "~/types";

import { resolveBindingDelivery } from "./binding-delivery";
import { recordChannelAttention } from "./channel-attention";
import { judgeChannelEvent, type ChannelEventJudgement } from "./channel-event-judgement";
import { getActiveChannelMessages } from "./history";
import { resolveProviderDelivery } from "./provider-delivery";

export type InboundChannelResult =
  | {
      status: "delivered";
      conversationId: string;
      body: string;
      needsAttention?: boolean;
    }
  | { status: "ignored"; conversationId: string; needsAttention?: boolean }
  | { status: "unauthorised_sender" }
  | { status: "channel_unavailable" };

async function executeInboundChannelMessage(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  data: InboundChannelTaskData;
}): Promise<InboundChannelResult> {
  const profile = getInboundChannelProfile(params.data.channel);
  const { message } = params.data;
  const delivery = isInboundBindingTaskData(params.data)
    ? await resolveBindingDelivery({ ...params, data: params.data })
    : await resolveProviderDelivery({ ...params, data: params.data });

  if (delivery.status !== "ready") {
    return delivery;
  }

  const { conversationId } = delivery;
  const commandDigest = await sha256Hex(
    [params.data.channel, conversationId, message.messageId].join(":"),
  );
  const commandId = `channel_message_${commandDigest.slice(0, 40)}`;
  const existing = await params.context.repositories.conversationRuns.getCommandReceipt(
    params.user.id,
    commandId,
  );
  let completion;
  let judgement: ChannelEventJudgement | undefined;

  if (existing?.run.conversationId === conversationId) {
    const recovery = await recoverChatCompletionResponse(params.context, existing);

    if (recovery.state === "in_progress") {
      throw new AssistantError(
        "The accepted channel response is still running",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    completion = recovery.response;
  } else {
    if (delivery.interactionMode === "automated") {
      judgement = await judgeChannelEvent({
        env: params.env,
        user: params.user,
        channel: params.data.channel,
        conversationId,
        message,
      });
      await delivery.validate();

      if (!judgement.shouldReply) {
        if (judgement.needsAttention) {
          await recordChannelAttention({
            context: params.context,
            user: params.user,
            conversationId,
            projectId: delivery.projectId,
            channelLabel: profile.label,
            message,
            messageId: `channel_attention_${commandDigest.slice(0, 40)}`,
          });
        }

        return {
          status: "ignored",
          conversationId,
          ...(judgement.needsAttention ? { needsAttention: true } : {}),
        };
      }
    }

    await delivery.validate();

    const activeMessages = await getActiveChannelMessages({
      context: params.context,
      user: params.user,
      conversationId,
      historyLimit: profile.historyLimit,
    });
    const request = createChatCompletionsJsonSchema.parse({
      completion_id: conversationId,
      command_id: commandId,
      stream: false,
      store: true,
      mode: "agent",
      trigger: "channel",
      max_steps: profile.maxSteps,
      enabled_tools: profile.tools,
      tool_choice: "auto",
      ...(delivery.projectId ? { metadata: { project_id: delivery.projectId } } : {}),
      messages: [
        ...activeMessages,
        {
          role: "user",
          content: buildInboundMessageContent({
            body: message.body,
            media: message.media,
          }),
        },
      ],
      options: {
        channel: {
          id: profile.id,
          ...(message.from ? { from: message.from } : {}),
          ...(message.to ? { to: message.to } : {}),
        },
      },
    });

    completion = delivery.teammateId
      ? await enqueueTeammateRun({
          env: params.env,
          context: params.context,
          body: request,
          teammateId: delivery.teammateId,
          user: params.user,
          anonymousUser: undefined,
          trigger: "channel",
          invocation: isInboundBindingTaskData(params.data)
            ? {
                source: "channel",
                bindingId: params.data.bindingId,
                thread: params.data.thread,
                from: message.from,
                messageId: message.messageId,
              }
            : undefined,
        })
      : await handleCreateChatCompletions({
          env: params.env,
          context: params.context,
          user: params.user,
          request: {
            ...request,
            ...(isInboundBindingTaskData(params.data)
              ? {
                  resolved_configuration: {
                    channelDelivery: {
                      bindingId: params.data.bindingId,
                      thread: params.data.thread,
                      from: message.from,
                    },
                  },
                }
              : {}),
          },
        });
  }

  const notification = extractChatCompletionNotification(completion, {
    streamingMessage: `${profile.label} assistant responses cannot be streamed`,
  });

  await delivery.validate();

  await deliverOutboundOperation({
    context: params.context,
    deliveryId: `channel_reply_${commandDigest.slice(0, 40)}`,
    userId: params.user.id,
    kind: "channel_reply",
    scopeId: conversationId,
    operationId: message.messageId,
    payload: {
      destination: message.from,
      body: notification.body,
      mediaUrls: notification.mediaUrls,
    },
    send: () => delivery.send({ body: notification.body, mediaUrls: notification.mediaUrls }),
  });

  if (judgement?.needsAttention) {
    await params.context.repositories.conversations.markUnreadForUser(
      conversationId,
      params.user.id,
    );
  }

  return {
    status: "delivered",
    conversationId,
    body: notification.body,
    ...(judgement?.needsAttention ? { needsAttention: true } : {}),
  };
}

export async function handleInboundChannelMessage(
  params: Parameters<typeof executeInboundChannelMessage>[0],
): Promise<InboundChannelResult> {
  try {
    return await executeInboundChannelMessage(params);
  } catch (error) {
    if (error instanceof ChannelDeliveryChangedError) {
      return { status: "channel_unavailable" };
    }

    throw error;
  }
}
