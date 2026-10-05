import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import type { IUser, Message } from "~/types";

export async function getActiveChannelMessages(params: {
  context: ServiceContext;
  user: IUser;
  conversationId: string;
  historyLimit: number;
}): Promise<Message[]> {
  const conversationManager = ConversationManager.getInstance({
    database: params.context.database,
    repositories: params.context.repositories,
    user: params.user,
    env: params.context.env,
    store: true,
    requestCache: params.context.requestCache,
  });

  let messages: Message[];

  try {
    messages = await conversationManager.get(params.conversationId);
  } catch (error) {
    if (error instanceof AssistantError && error.type === ErrorType.NOT_FOUND) {
      return [];
    }

    throw error;
  }

  const priorMessageLimit = params.historyLimit - 1;
  const archiveCount = Math.max(messages.length - priorMessageLimit, 0);

  if (archiveCount > 0) {
    const archiveIds = messages
      .slice(0, archiveCount)
      .flatMap((message) => (message.id ? [message.id] : []));

    await conversationManager.archiveMessages(params.conversationId, archiveIds);
  }

  return messages.slice(-priorMessageLimit);
}
