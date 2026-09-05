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

const ARCHIVE_OPTIONS: readonly OptionsMenuOption<ConversationArchiveFilter>[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const ACTIVITY_OPTIONS: readonly OptionsMenuOption<ConversationActivityWindow>[] = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Past 7 days" },
  { value: "month", label: "Past 30 days" },
];

const GROUP_BY_OPTIONS: readonly OptionsMenuOption<ConversationGroupBy>[] = [
  { value: "date", label: "Date" },
  { value: "type", label: "Type" },
  { value: "none", label: "None" },
];

const SORT_BY_OPTIONS: readonly OptionsMenuOption<ConversationSortBy>[] = [
  { value: "updated", label: "Last activity" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title" },
];

export function isDefaultConversationListFilters(
  filters: ConversationListFilters,
  defaults: ConversationListFilters = DEFAULT_CONVERSATION_LIST_FILTERS,
): boolean {
  return (
    filters.activity === defaults.activity &&
    filters.archiveFilter === defaults.archiveFilter &&
    filters.groupBy === defaults.groupBy &&
    filters.sortBy === defaults.sortBy
  );
}

export interface ConversationListControlsProps {
  defaults?: ConversationListFilters;
  filters: ConversationListFilters;
  showListFilters?: boolean;
  onFiltersChange: (filters: Partial<ConversationListFilters>) => void;
  onReset: () => void;
}

export function ConversationListControls({
  defaults = DEFAULT_CONVERSATION_LIST_FILTERS,
  filters,
  showListFilters = true,
  onFiltersChange,
  onReset,
}: ConversationListControlsProps) {
  const isCustomised = !isDefaultConversationListFilters(filters, defaults);

  return (
    <OptionsMenu
      trigger={
        <button
          type="button"
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          aria-label="Conversation list options"
          title="Conversation list options"
        >
          <SlidersHorizontal size={15} />
          {isCustomised && (
            <span className="bg-active-work absolute top-1 right-1 h-1.5 w-1.5 rounded-full" />
          )}
        </button>
      }
    >
      {showListFilters && (
        <>
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
        </>
      )}
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
