import {
  applyMessageReaction,
  readMessageReactions,
  reactionFeedbackValue,
  withMessageReactions,
} from "@ngriffin_uk/polychat-library-chat/reactions";
import type {
  ItemReactionRequest,
  ItemReactionResponse,
  MessageReaction,
  ReactionActor,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Repositories } from "~/infrastructure/database/repositories";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { publishMessageChanged } from "~/modules/sync/application/conversation-events";
import type { IEnv, Message } from "~/types";

import { submitConversationFeedback } from "./feedback-submission";
import { ConversationManager } from "./manager";

interface ReactionTarget {
  conversationId: string;
  message: Message;
}

interface ReactionWrite {
  env: IEnv;
  repositories: Repositories;
  target: ReactionTarget;
  actor: ReactionActor;
  actorId: string;
  emoji: string;
  remove?: boolean;
}

export async function writeItemReaction({
  env,
  repositories,
  target,
  actor,
  actorId,
  emoji,
  remove = false,
}: ReactionWrite): Promise<MessageReaction[]> {
  const reaction: MessageReaction = {
    emoji,
    actor,
    actor_id: actorId,
    created_at: new Date().toISOString(),
  };
  const reactions = applyMessageReaction(
    readMessageReactions(target.message.data),
    reaction,
    remove,
  );

  await repositories
    .get(MessageRepository)
    .updateMessage(target.conversationId, target.message.id, {
      data: withMessageReactions(target.message.data, reactions),
    });

  if (!target.message.run_id) {
    await publishMessageChanged({ env }, target.conversationId, { messageId: target.message.id });
  }

  return reactions;
}

export async function readReactionTarget(
  manager: ConversationManager,
  conversationId: string,
  itemId: string,
): Promise<ReactionTarget> {
  const { message, conversation_id: ownerConversationId } = await manager.getMessageById(itemId);

  if (ownerConversationId !== conversationId) {
    throw new AssistantError("Item not found", ErrorType.NOT_FOUND, 404);
  }

  return { conversationId, message };
}

export async function reactToConversationItem(
  context: ServiceContext,
  conversationId: string,
  request: ItemReactionRequest,
): Promise<ItemReactionResponse> {
  const user = context.requireUser();

  context.ensureDatabase();
  const manager = ConversationManager.getInstance({ repositories: context.repositories, user });
  const target = await readReactionTarget(manager, conversationId, request.item_id);

  if (target.message.role !== "assistant") {
    throw new AssistantError("You can only react to replies", ErrorType.PARAMS_ERROR, 400);
  }

  const reactions = await writeItemReaction({
    env: context.env,
    repositories: context.repositories,
    target,
    actor: "person",
    actorId: String(user.id),
    emoji: request.emoji,
    remove: request.remove,
  });
  const feedback = reactionFeedbackValue(request.emoji);

  if (feedback && !request.remove) {
    await submitConversationFeedback(context, conversationId, {
      message_id: target.message.id,
      feedback,
    });
  }

  return { item_id: request.item_id, reactions };
}
