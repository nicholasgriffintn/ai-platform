import type {
  ConversationGroup,
  ConversationGroupBy,
} from "@ngriffin_uk/polychat-component-navigation";

import type { Conversation, ConversationSortBy } from "~/types";

import { categorizeItemsByDate, type CategorizedItems } from "./sidebar";

const DATE_GROUPS: readonly { key: keyof CategorizedItems<Conversation>; title: string }[] = [
  { key: "today", title: "Today" },
  { key: "yesterday", title: "Yesterday" },
  { key: "thisWeek", title: "This Week" },
  { key: "thisMonth", title: "This Month" },
  { key: "lastMonth", title: "Last Month" },
  { key: "older", title: "Older" },
];

function getGroupDate(conversation: Conversation, sortBy: ConversationSortBy): Date {
  if (sortBy === "created" && conversation.created_at) {
    return new Date(conversation.created_at);
  }

  if (sortBy !== "created" && conversation.updated_at) {
    return new Date(conversation.updated_at);
  }

  if (conversation.last_message_at) {
    return new Date(conversation.last_message_at);
  }

  if (conversation.created_at) {
    return new Date(conversation.created_at);
  }

  return new Date(0);
}

function toGroupItem(conversation: Conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    isLocalOnly: conversation.isLocalOnly,
    parentConversationId: conversation.parent_conversation_id,
  };
}

export function buildConversationGroups(
  conversations: Conversation[],
  options: { groupBy: ConversationGroupBy; sortBy: ConversationSortBy },
): ConversationGroup[] {
  if (options.groupBy === "none") {
    return [{ id: "all", conversations: conversations.map(toGroupItem) }];
  }

  const categorised = categorizeItemsByDate(conversations, (conversation) =>
    getGroupDate(conversation, options.sortBy),
  );

  return DATE_GROUPS.map(({ key, title }) => ({
    id: key,
    title,
    conversations: categorised[key].map(toGroupItem),
  }));
}
