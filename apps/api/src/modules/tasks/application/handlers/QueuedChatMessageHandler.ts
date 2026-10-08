import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  createChatCompletionsJsonSchema,
  isTerminalChatRunStatus,
  queuedChatTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { buildChatRunCommandPayload } from "~/modules/chat-runs/application/command-payload";
import { handleCreateChatCompletions } from "~/modules/completions/application/createChatCompletions";
import { ConversationManager } from "~/modules/conversations/application/manager";
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
    const latest =
      await baseContext.repositories.conversationRuns.getLatestForConversation(conversationId);

    if (latest && !isTerminalChatRunStatus(latest.status)) {
      return { status: "suspended", message: "Waiting for the current reply to finish" };
    }

    const user = await baseContext.repositories.users.getUserById(message.user_id);
    const conversation =
      await baseContext.repositories.conversations.getConversation(conversationId);

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
      database: context.database,
      repositories: context.repositories,
      user,
      env,
      store: true,
      requestCache: context.requestCache,
    }).get(conversationId);
    const chatRequest = createChatCompletionsJsonSchema.parse({
      ...buildChatRunCommandPayload({
        ...request,
        env,
        completion_id: conversationId,
        store: true,
        messages: [...history, { ...userMessage, content: userMessage.content ?? "" }],
      }),
      command_id: message.taskId,
      stream: false,
    });

    try {
      await handleCreateChatCompletions({ env, context, user, request: chatRequest });
    } catch (error) {
      if (error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR) {
        return { status: "suspended", message: "The conversation is busy" };
      }

      throw error;
    }

    return { status: "success", message: "Queued message sent" };
  }
}
