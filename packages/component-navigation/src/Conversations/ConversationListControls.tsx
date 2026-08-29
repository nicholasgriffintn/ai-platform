import {
  OptionsMenu,
  OptionsMenuAction,
  type OptionsMenuOption,
  OptionsMenuSection,
  OptionsMenuSeparator,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  ConversationActivityWindow,
  ConversationArchiveFilter,
  ConversationSortBy,
} from "@ngriffin_uk/polychat-schemas";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

/** Presentation-only: the API never groups, the sidebar does. */
export type ConversationGroupBy = "date" | "none";

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

const ARCHIVE_OPTIONS: readonly OptionsMenuOption<ConversationArchiveFilter>[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const ACTIVITY_OPTIONS: readonly OptionsMenuOption<ConversationActivityWindow>[] = [
  { value: "all", label: "Any time" },
  { value: "day", label: "Past 24 hours" },
  { value: "week", label: "Past 7 days" },
  { value: "month", label: "Past 30 days" },
];

const GROUP_BY_OPTIONS: readonly OptionsMenuOption<ConversationGroupBy>[] = [
  { value: "date", label: "Date" },
  { value: "none", label: "None" },
];

const SORT_BY_OPTIONS: readonly OptionsMenuOption<ConversationSortBy>[] = [
  { value: "updated", label: "Last activity" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title" },
];

export function isDefaultConversationListFilters(filters: ConversationListFilters): boolean {
  return (
    filters.activity === DEFAULT_CONVERSATION_LIST_FILTERS.activity &&
    filters.archiveFilter === DEFAULT_CONVERSATION_LIST_FILTERS.archiveFilter &&
    filters.groupBy === DEFAULT_CONVERSATION_LIST_FILTERS.groupBy &&
    filters.sortBy === DEFAULT_CONVERSATION_LIST_FILTERS.sortBy
  );
}

export interface ConversationListControlsProps {
  filters: ConversationListFilters;
  onFiltersChange: (filters: Partial<ConversationListFilters>) => void;
  onReset: () => void;
}

export function ConversationListControls({
  filters,
  onFiltersChange,
  onReset,
}: ConversationListControlsProps) {
  const isCustomised = !isDefaultConversationListFilters(filters);

  return (
    <OptionsMenu
      trigger={
        <button
          type="button"
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 data-[state=open]:bg-zinc-200 data-[state=open]:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:data-[state=open]:bg-zinc-800 dark:data-[state=open]:text-zinc-100"
          aria-label="Conversation list options"
          title="Conversation list options"
        >
          <SlidersHorizontal size={15} />
          {isCustomised && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      }
    >
      <OptionsMenuSection
        label="Status"
        value={filters.archiveFilter}
        options={ARCHIVE_OPTIONS}
        onChange={(archiveFilter) => onFiltersChange({ archiveFilter })}
      />
      <OptionsMenuSection
        label="Last activity"
        value={filters.activity}
        options={ACTIVITY_OPTIONS}
        onChange={(activity) => onFiltersChange({ activity })}
      />
      <OptionsMenuSeparator />
      <OptionsMenuSection
        label="Group by"
        value={filters.groupBy}
        options={GROUP_BY_OPTIONS}
        onChange={(groupBy) => onFiltersChange({ groupBy })}
      />
      <OptionsMenuSection
        label="Sort by"
        value={filters.sortBy}
        options={SORT_BY_OPTIONS}
        onChange={(sortBy) => onFiltersChange({ sortBy })}
      />
      {isCustomised && (
        <>
          <OptionsMenuSeparator />
          <OptionsMenuAction onSelect={onReset}>
            <RotateCcw size={13} className="mr-2 shrink-0" aria-hidden="true" />
            Reset to defaults
          </OptionsMenuAction>
        </>
      )}
    </OptionsMenu>
  );
}
