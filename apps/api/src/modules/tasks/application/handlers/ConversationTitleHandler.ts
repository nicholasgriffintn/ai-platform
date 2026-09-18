import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { conversationTitleTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { formatStoredMessage } from "~/modules/conversations/application/stored-message";
import { generateConversationTitle } from "~/modules/conversations/application/title-generation";
import { needsRicherTitleContext } from "~/modules/conversations/application/title-source";
import { conversationAudience } from "~/modules/sync/application/audience";
import { publishConversationChanged } from "~/modules/sync/application/conversation-events";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

const logger = getLogger({ prefix: "services/tasks/handlers/ConversationTitleHandler" });

export class ConversationTitleHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const parsed = conversationTitleTaskDataSchema.safeParse(message.task_data);

    if (!parsed.success || !message.user_id) {
      return {
        status: "error",
        message: "user_id and conversationId are required to title a conversation",
      };
    }

    const baseContext = createServiceContext({ env });
    const user = await baseContext.repositories.users.getUserById(message.user_id);

    if (!user) {
      return {
        status: "error",
        message: `User ${message.user_id} not found for conversation titling`,
      };
    }

    const context = createServiceContext({ env, user });
    const { conversationId } = parsed.data;
    const audience = await conversationAudience(env, conversationId);

    if (!audience.includes(user.id)) {
      return { status: "skipped", message: "User cannot access this conversation" };
    }

    const conversation = await context.repositories.conversations.getConversation(conversationId);

    if (!conversation) {
      return { status: "skipped", message: "Conversation no longer exists" };
    }

    const messages = (
      await context.repositories.messages.getConversationMessages(conversationId, 0)
    ).map(formatStoredMessage);

    if (!needsRicherTitleContext(messages)) {
      return { status: "skipped", message: "The opening message already carries enough context" };
    }

    const title = await generateConversationTitle(context, messages);
    const currentTitle = typeof conversation.title === "string" ? conversation.title : null;

    if (!title || title === currentTitle) {
      return { status: "skipped", message: "Conversation already carries this title" };
    }

    await context.repositories.conversations.updateConversation(conversationId, { title });

    const inFlight: Promise<unknown>[] = [];

    try {
      await publishConversationChanged(
        { env, waitUntil: (work) => inFlight.push(work) },
        conversationId,
        { title },
      );
      await Promise.allSettled(inFlight);
    } catch (error) {
      logger.warn("Failed to publish the conversation title", { error, conversationId });
    }

    return { status: "success", message: "Conversation title updated", data: { title } };
  }
}
