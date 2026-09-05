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
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
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
        <p className="text-muted-foreground px-2 py-1.5">
          Filter by status to archive or restore in bulk.
        </p>
      )}
    </OptionsMenu>
  );
}
