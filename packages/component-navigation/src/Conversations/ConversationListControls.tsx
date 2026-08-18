import {
  FormSelect,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import { SlidersHorizontal } from "lucide-react";

export type ConversationArchiveFilter = "active" | "archived" | "all";
export type ConversationSortBy = "updated" | "created";

export interface ConversationListControlsProps {
  archiveFilter: ConversationArchiveFilter;
  sortBy: ConversationSortBy;
  onArchiveFilterChange: (filter: ConversationArchiveFilter) => void;
  onSortByChange: (sortBy: ConversationSortBy) => void;
}

export function ConversationListControls({
  archiveFilter,
  sortBy,
  onArchiveFilterChange,
  onSortByChange,
}: ConversationListControlsProps) {
  const isCustomised = archiveFilter !== "active" || sortBy !== "updated";

  return (
    <Popover>
      <PopoverAnchor asChild>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Conversation list options"
            title="Conversation list options"
          >
            <SlidersHorizontal size={15} />
            {isCustomised && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
          </button>
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-56 space-y-3 border-zinc-200 bg-off-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <FormSelect
          label="State"
          aria-label="Conversation archive filter"
          value={archiveFilter}
          onChange={(event) =>
            onArchiveFilterChange(event.target.value as ConversationArchiveFilter)
          }
          className="h-8 px-2 py-1 text-xs"
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
            { value: "all", label: "All" },
          ]}
        />
        <FormSelect
          label="Sort"
          aria-label="Conversation sort"
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as ConversationSortBy)}
          className="h-8 px-2 py-1 text-xs"
          options={[
            { value: "updated", label: "Updated" },
            { value: "created", label: "Created" },
          ]}
        />
      </PopoverContent>
    </Popover>
  );
}
