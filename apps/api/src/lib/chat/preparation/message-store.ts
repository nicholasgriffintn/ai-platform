import { getAllAttachments } from "~/lib/chat/messages/attachments";
import { messagesMatchStoredPrefix } from "~/lib/chat/messages/comparison";
import { hasSnapshotPart } from "~/lib/chat/messages/parts";
import { buildUserMessageData } from "~/lib/chat/policy/mode-metadata";
import type { ConversationManager } from "~/lib/conversationManager";
import type { ChatMode, CoreChatOptions, Message, Platform } from "~/types";
import { generateId } from "~/utils/id";

export interface StoreUserTurnParams {
  options: CoreChatOptions;
  conversationManager: ConversationManager;
  lastMessage: Message;
  finalMessage: string;
  primaryModel: string;
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
      data: buildUserMessageData(options.options, options.background),
      id: generateId(),
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
    // A conversation we cannot read is treated as absent; the append path below
    // still stores the turn rather than failing the request.
    return null;
  }
}

/**
 * Persist the incoming user turn.
 *
 * The client resends history it believes is current, which may be shorter than
 * what is stored once compaction has run. Replacing from that shorter list would
 * silently discard the snapshot, so a compacted conversation only accepts a
 * replacement when the client is itself snapshot-aware.
 */
export async function storeUserTurn({
  options,
  conversationManager,
  lastMessage,
  finalMessage,
  primaryModel,
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

  const incomingMessages = Array.isArray(options.messages) ? options.messages : [];
  const hasCompactedActiveHistory = existingMessages?.some(hasSnapshotPart) ?? false;
  const incomingHasSnapshot = incomingMessages.some(hasSnapshotPart);
  const latestExistingMessage = existingMessages?.at(-1);

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

  if (canReplaceFromIncoming && existingMessages) {
    if (existingMessages.length > incomingMessages.length) {
      await conversationManager.replaceMessages(options.completion_id, incomingMessages);

      return;
    }

    if (existingMessages.length === incomingMessages.length) {
      if (messagesMatchStoredPrefix(existingMessages, incomingMessages)) {
        return;
      }

      await conversationManager.replaceMessages(options.completion_id, incomingMessages);

      return;
    }
  }

  await conversationManager.addBatch(options.completion_id, messagesToStore, {
    metadata: options.metadata || {},
  });
}
