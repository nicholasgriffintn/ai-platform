import type { ChatEventSink } from "~/lib/chat/streaming/emitter";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { generateConversationTitle } from "~/lib/conversation/title-generation";
import {
  isPlaceholderConversationTitle,
  needsRicherTitleContext,
} from "~/lib/conversation/title-source";
import type { ConversationManager } from "~/lib/conversationManager";
import type { Message } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/agent/conversation-title" });

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

      try {
        return await apply(
          await generateConversationTitle(context, [...params.messages, finalMessage]),
        );
      } catch (error) {
        logger.warn("Failed to retitle the conversation", {
          error,
          completionId: params.completionId,
        });

        return title;
      }
    },
  };
}
