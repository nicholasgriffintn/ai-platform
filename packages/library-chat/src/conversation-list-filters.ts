import type {
  ConversationActivityWindow,
  ConversationArchiveFilter,
  ConversationSortBy,
} from "./conversation-types";

export type ConversationGroupBy = "date" | "type" | "none";

export interface ConversationListFilters {
  activity: ConversationActivityWindow;
  archiveFilter: ConversationArchiveFilter;
  groupBy: ConversationGroupBy;
  sortBy: ConversationSortBy;
}

export const DEFAULT_CONVERSATION_LIST_FILTERS: ConversationListFilters = {
  activity: "all",
  archiveFilter: "active",
  groupBy: "date",
  sortBy: "updated",
};

export const DEFAULT_WORK_CONVERSATION_LIST_FILTERS: ConversationListFilters = {
  ...DEFAULT_CONVERSATION_LIST_FILTERS,
  groupBy: "type",
};
