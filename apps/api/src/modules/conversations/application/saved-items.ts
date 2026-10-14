import {
  excerptMemoryDocument,
  toListPage,
  type ListPage,
  type SaveItemInput,
  type SavedItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import type { SavedItemRow } from "~/modules/conversations/infrastructure/SavedItemRepository";

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

function toSavedItem(row: SavedItemRow): SavedItem {
  return {
    id: row.message_id,
    conversation_id: row.conversation_id,
    conversation_title: row.conversation_title,
    note: row.note,
    excerpt: excerptMemoryDocument(readMessageText(row.message_content)),
    saved_at: row.saved_at,
  };
}

export async function saveItem(context: ServiceContext, input: SaveItemInput): Promise<SavedItem> {
  context.ensureDatabase();
  const user = context.requireUser();

  await requireConversationAccess(context, input.conversation_id);

  if (
    !(await context.repositories.savedItems.belongsToConversation(
      input.item_id,
      input.conversation_id,
    ))
  ) {
    throw new AssistantError(
      "That item is not part of this conversation",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  await context.repositories.savedItems.save({
    userId: user.id,
    conversationId: input.conversation_id,
    messageId: input.item_id,
    note: input.note ?? null,
  });

  const saved = await context.repositories.savedItems.find(user.id, input.item_id);

  if (!saved) {
    throw new AssistantError("The saved item could not be read back", ErrorType.UNKNOWN_ERROR, 500);
  }

  return toSavedItem(saved);
}

export async function unsaveItem(
  context: ServiceContext,
  itemId: string,
): Promise<{ deleted: true }> {
  context.ensureDatabase();
  const user = context.requireUser();

  await context.repositories.savedItems.unsave(user.id, itemId);

  return { deleted: true };
}

export async function listSavedItems(
  context: ServiceContext,
  options: { limit: number; after?: string; conversationId?: string },
): Promise<ListPage<SavedItem>> {
  context.ensureDatabase();
  const user = context.requireUser();

  if (options.conversationId) {
    await requireConversationAccess(context, options.conversationId);
  }

  const rows = await context.repositories.savedItems.list(user.id, options);
  const page = toListPage(rows, options.limit, (row) => row.message_id);

  return { ...page, data: page.data.map(toSavedItem) };
}
