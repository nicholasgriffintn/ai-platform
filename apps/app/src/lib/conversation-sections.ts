import type {
  ConversationGroupBy,
  ConversationSection,
  ConversationSummary,
} from "@ngriffin_uk/polychat-component-navigation";
import type { ConversationGroup, ConversationType } from "@ngriffin_uk/polychat-schemas";
import { compareNaturalText, sortCopy } from "@ngriffin_uk/polychat-utility-core";

import type { ConversationSortBy } from "~/types";

import { categorizeItemsByDate, type CategorizedItems } from "./sidebar";

export interface ConversationSectionSource {
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
  isPinned?: boolean;
  isUnread?: boolean;
  group?: ConversationGroup | null;
}

const DATE_SECTIONS: readonly {
  key: keyof CategorizedItems<ConversationSectionSource>;
  title: string;
}[] = [
  { key: "today", title: "Today" },
  { key: "yesterday", title: "Yesterday" },
  { key: "thisWeek", title: "This Week" },
  { key: "thisMonth", title: "This Month" },
  { key: "lastMonth", title: "Last Month" },
  { key: "older", title: "Older" },
];

function getSectionDate(conversation: ConversationSectionSource, sortBy: ConversationSortBy): Date {
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

function toSummary(conversation: ConversationSectionSource): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    isLocalOnly: conversation.isLocalOnly,
    parentConversationId: conversation.parentConversationId,
    needsInput: conversation.needsInput,
    isStreaming: conversation.isStreaming,
    isPinned: conversation.isPinned,
    isUnread: conversation.isUnread,
    group: conversation.group,
  };
}

function sortConversations(
  conversations: ConversationSectionSource[],
  sortBy: ConversationSortBy,
): ConversationSectionSource[] {
  return sortCopy(conversations, (left, right) => {
    const pinOrder = Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned));

    if (pinOrder !== 0) {
      return pinOrder;
    }

    if (sortBy === "title") {
      return compareNaturalText(
        left.title || "New conversation",
        right.title || "New conversation",
      );
    }

    return getSectionDate(right, sortBy).getTime() - getSectionDate(left, sortBy).getTime();
  });
}

function buildGroupSections(conversations: ConversationSectionSource[]): ConversationSection[] {
  const sectionsByGroup = new Map<string, ConversationSection>();

  for (const conversation of conversations) {
    if (!conversation.group) {
      continue;
    }

    const section = sectionsByGroup.get(conversation.group.id) ?? {
      id: `group:${conversation.group.id}`,
      title: conversation.group.name,
      conversations: [],
    };

    section.conversations.push(toSummary(conversation));
    sectionsByGroup.set(conversation.group.id, section);
  }

  return sortCopy([...sectionsByGroup.values()], (left, right) =>
    compareNaturalText(left.title ?? "", right.title ?? ""),
  );
}

function buildUngroupedSections(
  conversations: ConversationSectionSource[],
  options: { groupBy: ConversationGroupBy; sortBy: ConversationSortBy },
): ConversationSection[] {
  if (options.groupBy === "none") {
    return [{ id: "all", conversations: conversations.map(toSummary) }];
  }

  if (options.groupBy === "type") {
    return [
      {
        id: "task",
        title: "Tasks",
        conversations: conversations
          .filter((conversation) => conversation.type === "task")
          .map(toSummary),
      },
      {
        id: "chat",
        title: "Chats",
        conversations: conversations
          .filter((conversation) => conversation.type !== "task")
          .map(toSummary),
      },
    ];
  }

  const categorised = categorizeItemsByDate(conversations, (conversation) =>
    getSectionDate(conversation, options.sortBy),
  );

  return DATE_SECTIONS.map(({ key, title }) => ({
    id: key,
    title,
    conversations: categorised[key].map(toSummary),
  }));
}

export function buildConversationSections(
  conversations: ConversationSectionSource[],
  options: { groupBy: ConversationGroupBy; sortBy: ConversationSortBy },
): ConversationSection[] {
  const sortedConversations = sortConversations(conversations, options.sortBy);
  const ungrouped = sortedConversations.filter((conversation) => !conversation.group);

  return [
    ...buildGroupSections(sortedConversations),
    ...buildUngroupedSections(ungrouped, options),
  ];
}
