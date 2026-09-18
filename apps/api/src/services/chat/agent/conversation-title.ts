import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { CONVERSATION_TITLE_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { TaskRepository } from "~/repositories/TaskRepository";
import type { ChatEventSink } from "~/services/chat/streaming/emitter";
import type { ConversationManager } from "~/services/conversations/manager";
import { generateConversationTitle } from "~/services/conversations/title-generation";
import {
  isPlaceholderConversationTitle,
  needsRicherTitleContext,
} from "~/services/conversations/title-source";
import { publishConversationChanged } from "~/services/sync/conversation-events";
import { TaskService } from "~/services/tasks/TaskService";
import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/agent/conversation-title" });

const OPENING_TURN_MAX_MESSAGES = 2;

export interface ConversationTitleRunParams {
  completionId: string;
  conversationManager: ConversationManager;
  messages: Message[];
  sink: ChatEventSink;
  context?: ServiceContext;
  store?: boolean;
}

export interface ConversationTitleRun {
  complete: (finalMessage?: Message) => Promise<string | null>;
}

const NO_TITLE_RUN: ConversationTitleRun = { complete: async () => null };

export function startConversationTitle(params: ConversationTitleRunParams): ConversationTitleRun {
  const context = params.context;

  if (!context?.user?.id || params.store === false || !params.completionId) {
    return NO_TITLE_RUN;
  }

  let applied: string | null = null;

  const apply = async (title: string): Promise<string | null> => {
    if (!title || title === applied) {
      return applied;
    }

    await params.conversationManager.updateConversation(params.completionId, { title });
    applied = title;
    await params.sink.writeEvent("state", { state: "conversation_title", title });

    try {
      await publishConversationChanged(
        { env: context.env, waitUntil: context.waitUntil },
        params.completionId,
        { title },
      );
    } catch (error) {
      logger.warn("Failed to publish the conversation title", {
        error,
        completionId: params.completionId,
      });
    }

    return title;
  };

  const opening = (async () => {
    const conversation = await params.conversationManager.getConversationMetadata(
      params.completionId,
    );

    if (Number(conversation.message_count ?? 0) > OPENING_TURN_MAX_MESSAGES) {
      return null;
    }

    if (!isPlaceholderConversationTitle(conversation.title, params.messages)) {
      return null;
    }

    return apply(await generateConversationTitle(context, params.messages));
  })().catch((error) => {
    logger.warn("Failed to title the conversation", {
      error,
      completionId: params.completionId,
    });

    return null;
  });

  return {
    complete: async (finalMessage?: Message) => {
      const title = await opening;

      if (!title || !finalMessage || !needsRicherTitleContext(params.messages)) {
        return title;
      }

      await enqueueRicherTitleTask(params, finalMessage);

      return title;
    },
  };
}

async function enqueueRicherTitleTask(
  params: ConversationTitleRunParams,
  finalMessage: Message,
): Promise<void> {
  const context = params.context;
  const user = context?.user;

  if (!context?.env.TASK_QUEUE || !user?.id) {
    return;
  }

  const taskService = new TaskService(context.env, new TaskRepository(context.env));

  try {
    await taskService.enqueueTask({
      id: `conversation_title:${params.completionId}:${finalMessage.id ?? Date.now()}`,
      task_type: CONVERSATION_TITLE_TASK_TYPE,
      user_id: user.id,
      task_data: { conversationId: params.completionId },
      priority: 6,
    });
  } catch (error) {
    logger.warn("Failed to queue the conversation title task", {
      error,
      completionId: params.completionId,
    });
  }
}
