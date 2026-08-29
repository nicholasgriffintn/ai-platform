import { OptionsMenu, OptionsMenuAction } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationArchiveFilter } from "@ngriffin_uk/polychat-schemas";
import { Archive, ArchiveRestore, MoreVertical } from "lucide-react";

export interface ConversationListActionsProps {
  archiveFilter: ConversationArchiveFilter;
  matchingCount: number;
  isBusy?: boolean;
  onArchiveAll: () => void;
  onRestoreAll: () => void;
}

export function ConversationListActions({
  archiveFilter,
  matchingCount,
  isBusy = false,
  onArchiveAll,
  onRestoreAll,
}: ConversationListActionsProps) {
  const isRestoring = archiveFilter === "archived";
  const isMixed = archiveFilter === "all";
  const isDisabled = isBusy || isMixed || matchingCount === 0;

  return (
    <OptionsMenu
      align="end"
      trigger={
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 data-[state=open]:bg-zinc-200 data-[state=open]:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:data-[state=open]:bg-zinc-800 dark:data-[state=open]:text-zinc-100"
          aria-label="Conversation list actions"
          title="Conversation list actions"
        >
          <MoreVertical size={15} />
        </button>
      }
    >
      <OptionsMenuAction disabled={isDisabled} onSelect={isRestoring ? onRestoreAll : onArchiveAll}>
        {isRestoring ? (
          <ArchiveRestore size={13} className="mr-2 shrink-0" aria-hidden="true" />
        ) : (
          <Archive size={13} className="mr-2 shrink-0" aria-hidden="true" />
        )}
        {isRestoring ? "Restore all" : "Archive all"}
        {!isMixed && matchingCount > 0 && ` (${matchingCount})`}
      </OptionsMenuAction>
      {isMixed && (
        <p className="px-2 py-1.5 text-zinc-500 dark:text-zinc-400">
          Filter by status to archive or restore in bulk.
        </p>
      )}
    </OptionsMenu>
  );
}
