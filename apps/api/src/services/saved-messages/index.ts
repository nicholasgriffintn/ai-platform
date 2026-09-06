import {
  excerptMemoryDocument,
  type SaveMessageInput,
  type SavedMessage,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { SavedMessageRow } from "~/repositories/SavedMessageRepository";
import { requireConversationAccess } from "~/services/conversations/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

const DEFAULT_LIMIT = 25;

function readMessageText(value: unknown): string {
  const parsed = typeof value === "string" ? (safeParseJson<unknown>(value) ?? value) : value;

  if (typeof parsed === "string") {
    return parsed;
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function toSavedMessage(row: SavedMessageRow): SavedMessage {
  return {
    id: row.id,
    messageId: row.message_id,
    conversationId: row.conversation_id,
    conversationTitle: row.conversation_title,
    note: row.note,
    excerpt: excerptMemoryDocument(readMessageText(row.message_content)),
    savedAt: row.saved_at,
  };
}

export async function saveMessage(context: ServiceContext, input: SaveMessageInput): Promise<void> {
  context.ensureDatabase();
  const user = context.requireUser();

  await requireConversationAccess(context, input.conversationId);

  if (
    !(await context.repositories.savedMessages.belongsToConversation(
      input.messageId,
      input.conversationId,
    ))
  ) {
    throw new AssistantError(
      "That message is not part of this conversation",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  await context.repositories.savedMessages.save({
    userId: user.id,
    conversationId: input.conversationId,
    messageId: input.messageId,
    note: input.note ?? null,
  });
}

export async function unsaveMessage(context: ServiceContext, messageId: string): Promise<void> {
  context.ensureDatabase();
  const user = context.requireUser();

  await context.repositories.savedMessages.unsave(user.id, messageId);
}

export async function listSavedMessages(
  context: ServiceContext,
  limit = DEFAULT_LIMIT,
): Promise<{ messages: SavedMessage[] }> {
  context.ensureDatabase();
  const user = context.requireUser();
  const rows = await context.repositories.savedMessages.list(user.id, limit);

  return { messages: rows.map(toSavedMessage) };
}

export async function listSavedMessageIds(
  context: ServiceContext,
  conversationId: string,
): Promise<string[]> {
  context.ensureDatabase();
  const user = context.requireUser();

  await requireConversationAccess(context, conversationId);

  return context.repositories.savedMessages.listSavedMessageIds(user.id, conversationId);
}
