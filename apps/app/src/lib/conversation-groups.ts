import type {
  ConversationGroup,
  ConversationGroupBy,
} from "@ngriffin_uk/polychat-component-navigation";
import type { ConversationType } from "@ngriffin_uk/polychat-schemas";
import { sortCopy } from "@ngriffin_uk/polychat-utility-core";

import type { ConversationSortBy } from "~/types";

import { categorizeItemsByDate, type CategorizedItems } from "./sidebar";

export interface ConversationGroupSource {
  id?: string;
  type?: ConversationType;
  title?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastMessageAt?: string | null;
  isLocalOnly?: boolean;
  parentConversationId?: string | null;
  needsInput?: boolean;
  isStreaming?: boolean;
}

const DATE_GROUPS: readonly {
  key: keyof CategorizedItems<ConversationGroupSource>;
  title: string;
}[] = [
  { key: "today", title: "Today" },
  { key: "yesterday", title: "Yesterday" },
  { key: "thisWeek", title: "This Week" },
  { key: "thisMonth", title: "This Month" },
  { key: "lastMonth", title: "Last Month" },
  { key: "older", title: "Older" },
];

function getGroupDate(conversation: ConversationGroupSource, sortBy: ConversationSortBy): Date {
  if (sortBy === "created" && conversation.createdAt) {
    return new Date(conversation.createdAt);
  }

  if (sortBy !== "created" && conversation.updatedAt) {
    return new Date(conversation.updatedAt);
  }

  if (conversation.lastMessageAt) {
    return new Date(conversation.lastMessageAt);
  }

  if (conversation.createdAt) {
    return new Date(conversation.createdAt);
  }

  return new Date(0);
}

function toGroupItem(conversation: ConversationGroupSource) {
  return {
    id: conversation.id,
    title: conversation.title,
    isLocalOnly: conversation.isLocalOnly,
    parentConversationId: conversation.parentConversationId,
    needsInput: conversation.needsInput,
    isStreaming: conversation.isStreaming,
  };
}

function sortConversations(
  conversations: ConversationGroupSource[],
  sortBy: ConversationSortBy,
): ConversationGroupSource[] {
  return sortCopy(conversations, (left, right) => {
    if (sortBy === "title") {
      return (left.title || "New conversation").localeCompare(
        right.title || "New conversation",
        undefined,
        { sensitivity: "base" },
      );
    }

    return getGroupDate(right, sortBy).getTime() - getGroupDate(left, sortBy).getTime();
  });
}

export function buildConversationGroups(
  conversations: ConversationGroupSource[],
  options: { groupBy: ConversationGroupBy; sortBy: ConversationSortBy },
): ConversationGroup[] {
  const sortedConversations = sortConversations(conversations, options.sortBy);

  if (options.groupBy === "none") {
    return [{ id: "all", conversations: sortedConversations.map(toGroupItem) }];
  }

  if (options.groupBy === "type") {
    return [
      {
        id: "task",
        title: "Tasks",
        conversations: sortedConversations
          .filter((conversation) => conversation.type === "task")
          .map(toGroupItem),
      },
      {
        id: "chat",
        title: "Chats",
        conversations: sortedConversations
          .filter((conversation) => conversation.type !== "task")
          .map(toGroupItem),
      },
    ];
  }

  const categorised = categorizeItemsByDate(sortedConversations, (conversation) =>
    getGroupDate(conversation, options.sortBy),
  );

  return DATE_GROUPS.map(({ key, title }) => ({
    id: key,
    title,
    conversations: categorised[key].map(toGroupItem),
  }));
}
