import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FormInput,
} from "@ngriffin_uk/polychat-component-ui";
import {
  Blocks,
  Building2,
  CornerDownLeft,
  FolderKanban,
  Loader2,
  MessageSquareText,
  Search,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type SearchResultKind = "conversation" | "project" | "workspace" | "capability";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  description: string;
  href: string;
}

export type SearchSelectionMethod = "click" | "keyboard";

export interface SearchDialogProps {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  hasQuery: boolean;
  hasError: boolean;
  isLoading: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (result: SearchResult, index: number, method: SearchSelectionMethod) => void;
  onOpened?: () => void;
}

const RESULT_ICONS: Record<SearchResultKind, ReactNode> = {
  conversation: <MessageSquareText size={18} />,
  project: <FolderKanban size={18} />,
  workspace: <Building2 size={18} />,
  capability: <Blocks size={18} />,
};

function getSearchStatusMessage({
  resultCount,
  isLoading,
  hasError,
}: {
  resultCount: number;
  isLoading: boolean;
  hasError: boolean;
}): string {
  if (resultCount > 0) {
    return `${resultCount} ${resultCount === 1 ? "result" : "results"} available`;
  }

  if (isLoading) {
    return "Searching Polychat";
  }

  if (hasError) {
    return "Search is temporarily unavailable";
  }

  return "No matches found";
}

export function SearchDialog({
  isOpen,
  query,
  results,
  hasQuery,
  hasError,
  isLoading,
  isUpdating,
  onClose,
  onQueryChange,
  onSelect,
  onOpened,
}: SearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedResultRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    onOpened?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen, onOpened]);

  useEffect(() => {
    setFocusedIndex((index) => Math.max(0, Math.min(index, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    focusedResultRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [focusedIndex]);

  const selectResult = (index: number, method: SearchSelectionMethod) => {
    const result = results[index];

    if (!result) {
      return;
    }

    onSelect(result, index, method);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      selectResult(focusedIndex, "keyboard");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} width="min(840px, 100%)">
      <DialogContent
        className="border-border bg-surface-elevated gap-0 overflow-hidden p-0 shadow-[var(--polychat-elevated-shadow)] [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:top-6"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Search Polychat</DialogTitle>
        <DialogDescription className="sr-only">
          Search conversations, projects, workspaces, and capabilities.
        </DialogDescription>

        <div className="border-border relative border-b px-5 py-4 pr-14">
          <Search
            size={21}
            className="text-muted-foreground pointer-events-none absolute left-6 top-1/2 -translate-y-1/2"
          />
          <FormInput
            id="global-search-input"
            ref={inputRef}
            aria-activedescendant={results[focusedIndex]?.id}
            aria-controls="global-search-results"
            aria-label="Search Polychat"
            aria-autocomplete="list"
            placeholder="Search chats, projects, capabilities…"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setFocusedIndex(0);
            }}
            className="h-12 border-0 bg-transparent pl-10 pr-20 text-base shadow-none focus:ring-0 dark:bg-transparent"
            fullWidth
          />
          <div className="pointer-events-none absolute right-14 top-1/2 hidden -translate-y-1/2 items-center gap-2 sm:flex">
            {isUpdating && <Loader2 size={15} className="text-active-work animate-spin" />}
            <kbd className="border-border bg-surface text-muted-foreground rounded border px-1.5 py-0.5 text-[11px] shadow-sm">
              ⌘K
            </kbd>
          </div>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {getSearchStatusMessage({ resultCount: results.length, isLoading, hasError })}
        </span>

        <div
          id="global-search-results"
          role="listbox"
          className="max-h-[min(64vh,560px)] overflow-y-auto p-3"
        >
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="text-muted-foreground px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                {hasQuery ? "Best matches" : "Recent"}
              </p>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  id={result.id}
                  ref={focusedIndex === index ? focusedResultRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={focusedIndex === index}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    focusedIndex === index
                      ? "bg-selection text-foreground"
                      : "text-foreground hover:bg-selection/60",
                  )}
                  onClick={() => selectResult(index, "click")}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      focusedIndex === index
                        ? "bg-active-work/15 text-active-work"
                        : "bg-surface text-muted-foreground",
                    )}
                  >
                    {RESULT_ICONS[result.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{result.title}</span>
                    <span className={cn("block truncate text-xs", "text-muted-foreground")}>
                      {result.description}
                    </span>
                  </span>
                  {focusedIndex === index && (
                    <CornerDownLeft size={16} className="shrink-0 opacity-70" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          ) : isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 size={17} className="animate-spin" /> Searching Polychat…
            </div>
          ) : hasError ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Search is temporarily unavailable. Try again in a moment.
            </p>
          ) : (
            <div className="py-16 text-center">
              <p className="text-foreground text-sm font-medium">No matches found</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Try another name, topic, or capability.
              </p>
            </div>
          )}
        </div>

        <div className="border-border text-muted-foreground hidden items-center justify-between border-t px-5 py-2.5 text-[11px] sm:flex">
          <span>Search across your accessible Polychat</span>
          <span>↑↓ Navigate · ↵ Open · Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
