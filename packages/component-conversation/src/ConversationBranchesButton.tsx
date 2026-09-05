import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import {
  flattenConversationBranches,
  type ConversationBranchesResponse,
} from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Check, GitBranch, MessageSquare, RotateCw } from "lucide-react";

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
          collapseLabel="container"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          title="Browse conversation branches"
          aria-label="Browse conversation branches"
          icon={<GitBranch className="h-3.5 w-3.5" />}
        >
          Branches
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,22rem)] overflow-hidden rounded-xl p-0 shadow-lg"
        aria-label="Conversation branches"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-3">
          <h2 className="text-xs font-semibold text-foreground">Branches</h2>
          {data && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {rows.length}
              {data.truncated ? "+" : ""} conversations
            </span>
          )}
        </div>
        {errorMessage ? (
          <div role="alert" className="space-y-3 p-3.5">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCw className="h-3.5 w-3.5" />}
              onClick={onRetry}
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <output className="flex items-center gap-2 px-3.5 py-5 text-xs text-muted-foreground">
            <RotateCw
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Loading branches…
          </output>
        ) : (
          <nav
            aria-label="Related conversations"
            className="max-h-[min(28rem,60dvh)] overflow-y-auto p-1.5"
          >
            <ul>
              {rows.map((branch) => {
                const current = branch.id === currentId;

                return (
                  <li
                    key={branch.id}
                    className="relative"
                    style={{ marginLeft: `${Math.min(branch.depth, 6) * 14}px` }}
                  >
                    {branch.depth > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -left-2 top-0 h-6 w-2 rounded-bl border-b border-l border-border-strong"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(branch.id)}
                      disabled={current}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "group my-0.5 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-active-work",
                        current ? "bg-selection" : "hover:bg-selection/60",
                      )}
                    >
                      {branch.depth === 0 ? (
                        <MessageSquare
                          aria-hidden="true"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                      ) : (
                        <GitBranch
                          aria-hidden="true"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-sm font-medium text-foreground"
                          title={branch.title || "Untitled conversation"}
                        >
                          {branch.title || "Untitled conversation"}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-muted-foreground">
                          {branch.depth === 0 && (
                            <>
                              <span>Original</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>{formatDate(branch.created_at)}</span>
                          {branch.is_archived && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Archived</span>
                            </>
                          )}
                        </span>
                      </span>
                      {current && (
                        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <Check aria-hidden="true" className="h-3 w-3" />
                          Current
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        {data?.truncated && (
          <p className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">
            Showing the first 200 conversations.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
