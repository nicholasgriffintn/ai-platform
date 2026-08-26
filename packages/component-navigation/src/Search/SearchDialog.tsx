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
  /** True once the debounced query is non-empty, which switches the heading to matches. */
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
        className="gap-0 overflow-hidden border-zinc-200 bg-off-white p-0 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:top-6"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Search Polychat</DialogTitle>
        <DialogDescription className="sr-only">
          Search conversations, projects, workspaces, and capabilities.
        </DialogDescription>

        <div className="relative border-b border-zinc-200 px-5 py-4 pr-14 dark:border-zinc-700">
          <Search
            size={21}
            className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400"
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
            {isUpdating && <Loader2 size={15} className="animate-spin text-zinc-400" />}
            <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              ⌘K
            </kbd>
          </div>
        </div>

        <div
          id="global-search-results"
          role="listbox"
          className="max-h-[min(64vh,560px)] overflow-y-auto p-3"
        >
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
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
                      ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
                  )}
                  onClick={() => selectResult(index, "click")}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      focusedIndex === index
                        ? "bg-white/12 text-white dark:bg-white/10 dark:text-zinc-50"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    {RESULT_ICONS[result.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{result.title}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        focusedIndex === index
                          ? "text-zinc-300 dark:text-zinc-300"
                          : "text-zinc-500 dark:text-zinc-400",
                      )}
                    >
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
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 size={17} className="animate-spin" /> Searching Polychat…
            </div>
          ) : hasError ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              Search is temporarily unavailable. Try again in a moment.
            </p>
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                No matches found
              </p>
              <p className="mt-1 text-xs text-zinc-500">Try another name, topic, or capability.</p>
            </div>
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-zinc-200 px-5 py-2.5 text-[11px] text-zinc-500 dark:text-zinc-400 dark:border-zinc-700 sm:flex">
          <span>Search across your accessible Polychat</span>
          <span>↑↓ Navigate · ↵ Open · Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
