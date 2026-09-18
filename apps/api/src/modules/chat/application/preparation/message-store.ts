import type { ModelTier, PermissionMode } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { getAllAttachments } from "~/modules/chat/application/messages/attachments";
import { messagesMatchStoredPrefix } from "~/modules/chat/application/messages/comparison";
import {
  mergeStoredGoalMarkers,
  withoutGoalMarkerMessages,
} from "~/modules/chat/application/messages/goal-marker-history";
import { hasSnapshotPart } from "~/modules/chat/application/messages/parts";
import { buildUserMessageData } from "~/modules/chat/domain/mode-metadata";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import type { ChatMode, CoreChatOptions, Message, Platform } from "~/types";

export interface StoreUserTurnParams {
  options: CoreChatOptions;
  conversationManager: ConversationManager;
  lastMessage: Message;
  finalMessage: string;
  primaryModel: string;
  modelId?: string;
  modelTier?: ModelTier | null;
  permissionMode?: PermissionMode;
  platform: Platform;
  mode: ChatMode;
}

function buildMessagesToStore({
  options,
  lastMessage,
  finalMessage,
  primaryModel,
  platform,
  mode,
}: Omit<StoreUserTurnParams, "conversationManager">): Message[] {
  const base = {
    role: lastMessage.role,
    model: primaryModel,
    platform: platform || "api",
    mode,
  };

  const messagesToStore: Message[] = [
    {
      ...base,
      content: finalMessage,
      data: buildUserMessageData(options.options),
      id: lastMessage.id ?? generateId(),
      timestamp: Date.now(),
    },
  ];

  const lastMessageContent = Array.isArray(lastMessage.content)
    ? lastMessage.content
    : [{ type: "text" as const, text: lastMessage.content as string }];

  const { allAttachments } = getAllAttachments(lastMessageContent);

  if (allAttachments.length > 0) {
    messagesToStore.push({
      ...base,
      content: "Attachments",
      data: { attachments: allAttachments },
      id: generateId(),
      timestamp: Date.now(),
    });
  }

  return messagesToStore;
}

async function readExistingMessages(
  conversationManager: ConversationManager,
  completionId?: string,
): Promise<Message[] | null> {
  if (!completionId) {
    return null;
  }

  try {
    return await conversationManager.get(completionId);
  } catch {
    return null;
  }
}

export async function storeUserTurn({
  options,
  conversationManager,
  lastMessage,
  finalMessage,
  primaryModel,
  modelId,
  modelTier,
  permissionMode,
  platform,
  mode,
}: StoreUserTurnParams): Promise<void> {
  const messagesToStore = buildMessagesToStore({
    options,
    lastMessage,
    finalMessage,
    primaryModel,
    platform,
    mode,
  });

  const existingMessages = await readExistingMessages(conversationManager, options.completion_id);
  const comparableExistingMessages = existingMessages
    ? withoutGoalMarkerMessages(existingMessages)
    : null;

  const incomingMessages = Array.isArray(options.messages) ? options.messages : [];
  const hasCompactedActiveHistory = existingMessages?.some(hasSnapshotPart) ?? false;
  const incomingHasSnapshot = incomingMessages.some(hasSnapshotPart);
  const latestExistingMessage = comparableExistingMessages?.at(-1);

  const isDuplicateOfCompactedTail =
    hasCompactedActiveHistory &&
    !incomingHasSnapshot &&
    latestExistingMessage?.role === lastMessage.role &&
    latestExistingMessage.content === finalMessage;

  if (isDuplicateOfCompactedTail) {
    return;
  }

  const canReplaceFromIncoming =
    incomingMessages.length > 0 && (!hasCompactedActiveHistory || incomingHasSnapshot);

  if (canReplaceFromIncoming && existingMessages && comparableExistingMessages) {
    if (comparableExistingMessages.length > incomingMessages.length) {
      await conversationManager.replaceMessages(
        options.completion_id,
        mergeStoredGoalMarkers(existingMessages, incomingMessages),
      );

      return;
    }

    if (comparableExistingMessages.length === incomingMessages.length) {
      if (messagesMatchStoredPrefix(comparableExistingMessages, incomingMessages)) {
        return;
      }

      await conversationManager.replaceMessages(
        options.completion_id,
        mergeStoredGoalMarkers(existingMessages, incomingMessages),
      );

      return;
    }
  }

  await conversationManager.addBatch(options.completion_id, messagesToStore, {
    metadata: options.metadata || {},
    type: options.conversation_type ?? (options.options?.recipe ? "task" : "chat"),
    model_id: modelId ?? primaryModel,
    model_tier: modelTier,
    permission_mode: permissionMode,
  });
}
