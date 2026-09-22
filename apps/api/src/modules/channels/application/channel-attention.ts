import { truncateText } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

export async function recordChannelAttention(params: {
  context: ServiceContext;
  user: IUser;
  conversationId: string;
  projectId?: string;
  channelLabel: string;
  message: { messageId: string; from: string; body: string };
  messageId: string;
}): Promise<void> {
  const existing = await params.context.repositories.conversations.getConversation(
    params.conversationId,
  );

  if (!existing) {
    await params.context.repositories.conversations.createConversation(
      params.conversationId,
      params.user.id,
      `${params.channelLabel} activity`,
      {
        type: "chat",
        ...(params.projectId ? { project_id: params.projectId } : {}),
      },
    );
  } else if (
    existing.user_id !== params.user.id ||
    (existing.project_id ?? undefined) !== params.projectId
  ) {
    throw new AssistantError("Channel conversation scope changed", ErrorType.FORBIDDEN, 403);
  }

  await params.context.repositories.messages.createProjectedMessage(params.conversationId, {
    id: params.messageId,
    role: "assistant",
    content: `**${params.channelLabel} message needs attention**\n\n${truncateText(params.message.body, 8_000)}`,
    data: {
      platform: "api",
      data: {
        channelAttention: {
          channel: params.channelLabel,
          externalMessageId: params.message.messageId,
          from: params.message.from,
        },
      },
    },
  });
  await params.context.repositories.conversations.markUnreadForUser(
    params.conversationId,
    params.user.id,
  );
}
