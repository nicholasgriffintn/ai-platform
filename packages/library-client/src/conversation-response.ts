import type { Conversation } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { normalizeMessage } from "@ngriffin_uk/polychat-library-chat/messages";
import {
  conversationTypeSchema,
  itemsToMessages,
  responseSchema,
  storedItemsSchema,
  type PlatformResponse,
} from "@ngriffin_uk/polychat-schemas";

type ConversationResponse = Omit<
  Partial<Conversation>,
  "messages" | "latest_response" | "type" | "title"
> & {
  id?: unknown;
  items?: unknown;
  messages?: unknown;
  latest_response?: unknown;
  type?: unknown;
  title?: unknown;
  item_count?: unknown;
  has_more_items?: unknown;
  oldest_item_id?: unknown;
};

export function normaliseConversationItems(items: unknown): Conversation["messages"] {
  const parsed = storedItemsSchema.safeParse(items);

  if (parsed.success) {
    return itemsToMessages(parsed.data).map((message) =>
      normalizeMessage(message as Parameters<typeof normalizeMessage>[0]),
    );
  }

  return Array.isArray(items)
    ? items.map((message) => normalizeMessage(message as Parameters<typeof normalizeMessage>[0]))
    : [];
}

function normaliseLatestResponse(value: unknown): PlatformResponse | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const parsed = responseSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function normaliseConversationResponse(
  conversation: ConversationResponse | null | undefined,
  fallbackId: string,
  fallbackTitle = "New conversation",
): Conversation {
  if (!conversation) {
    return {
      id: fallbackId,
      type: "chat",
      title: fallbackTitle,
      messages: [],
    };
  }

  const {
    items,
    messages,
    latest_response: latestResponse,
    item_count: itemCount,
    has_more_items: hasMoreItems,
    oldest_item_id: oldestItemId,
    ...rest
  } = conversation;
  const resolvedLatestResponse = normaliseLatestResponse(latestResponse);

  return {
    ...rest,
    id: typeof conversation.id === "string" ? conversation.id : fallbackId,
    type: conversationTypeSchema.safeParse(conversation.type).data ?? "chat",
    title: typeof conversation.title === "string" ? conversation.title : fallbackTitle,
    messages: normaliseConversationItems(items ?? messages),
    ...(resolvedLatestResponse !== undefined ? { latest_response: resolvedLatestResponse } : {}),
    ...(typeof itemCount === "number" ? { message_count: itemCount } : {}),
    ...(typeof hasMoreItems === "boolean" ? { has_more_messages: hasMoreItems } : {}),
    ...(oldestItemId === null || typeof oldestItemId === "string"
      ? { oldest_message_id: oldestItemId }
      : {}),
  };
}
