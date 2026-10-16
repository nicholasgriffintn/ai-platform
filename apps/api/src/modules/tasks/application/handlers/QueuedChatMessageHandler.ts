import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  isTerminalChatRunStatus,
  queuedChatTaskDataSchema,
  responseSettingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { toCommandMessages } from "~/modules/responses/application/runs/command-payload";
import { startResponse } from "~/modules/responses/application/start";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

export class QueuedChatMessageHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const parsed = queuedChatTaskDataSchema.safeParse(message.task_data);

    if (!parsed.success || !message.user_id) {
      return { status: "skipped", message: "Queued message is malformed" };
    }

    const { conversationId, message: userMessage, request } = parsed.data;
    const baseContext = createServiceContext({ env });
    const latest = await baseContext.repositories
      .get(ConversationRunRepository)
      .getLatestForConversation(conversationId);

    if (latest && !isTerminalChatRunStatus(latest.status)) {
      return { status: "suspended", message: "Waiting for the current reply to finish" };
    }

    const user = await baseContext.repositories.get(UserRepository).getUserById(message.user_id);
    const conversation = await baseContext.repositories
      .get(ConversationRepository)
      .getConversation(conversationId);

    if (
      !user ||
      !conversation ||
      conversation.project_id ||
      !ownsResource(user.id, conversation.user_id)
    ) {
      return { status: "skipped", message: "Queued message's conversation is unavailable" };
    }

    const context = createServiceContext({ env, user });
    const history = await ConversationManager.getInstance({
      repositories: context.repositories,
      user,
      env,
      store: true,
      requestCache: context.requestCache,
    }).get(conversationId);

    try {
      await startResponse({
        env,
        context,
        user,
        command: {
          conversationId,
          conversationType: request.conversation_type,
          commandId: message.taskId,
          messages: toCommandMessages([
            ...history,
            { ...userMessage, content: userMessage.content ?? "" },
          ]),
          stream: false,
          store: true,
          settings: responseSettingsSchema.parse(request),
        },
      });
    } catch (error) {
      if (error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR) {
        return { status: "suspended", message: "The conversation is busy" };
      }

      throw error;
    }

    return { status: "success", message: "Queued message sent" };
  }
}
