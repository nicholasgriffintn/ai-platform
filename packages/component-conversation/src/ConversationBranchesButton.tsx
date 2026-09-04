import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@ngriffin_uk/polychat-component-ui";
import {
  flattenConversationBranches,
  type ConversationBranchesResponse,
} from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { GitBranch } from "lucide-react";

export interface ConversationBranchesButtonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentId: string;
  data?: ConversationBranchesResponse;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onSelect: (id: string) => void;
}

export function ConversationBranchesButton({
  open,
  onOpenChange,
  currentId,
  data,
  isLoading,
  errorMessage,
  onRetry,
  onSelect,
}: ConversationBranchesButtonProps) {
  const rows = flattenConversationBranches(data?.branches ?? []);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Browse conversation branches"
          aria-label="Browse conversation branches"
          icon={<GitBranch className="h-3.5 w-3.5" />}
        >
          Branches
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[65dvh] w-[min(92vw,26rem)] overflow-y-auto"
        aria-label="Conversation branches"
      >
        <h2 className="mb-2 text-sm font-semibold">Conversation branches</h2>
        {errorMessage ? (
          <div role="alert">
            <p className="text-sm text-red-700">{errorMessage}</p>
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-zinc-500">Loading branches…</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((branch) => (
              <li key={branch.id} style={{ paddingLeft: `${Math.min(branch.depth, 8) * 12}px` }}>
                <button
                  type="button"
                  onClick={() => onSelect(branch.id)}
                  aria-current={branch.id === currentId ? "page" : undefined}
                  className="w-full rounded px-2 py-2 text-left hover:bg-zinc-100 focus-visible:outline-2 aria-[current=page]:bg-zinc-100 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-zinc-800"
                >
                  <span className="block truncate text-sm">
                    {branch.title || "Untitled conversation"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatDate(branch.created_at)}
                    {branch.is_archived ? " · Archived" : ""}
                    {branch.id === currentId ? " · Current" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data?.truncated && (
          <p className="mt-2 text-xs text-zinc-500">
            Showing up to 200 related conversations. Open a branch to explore from there.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
