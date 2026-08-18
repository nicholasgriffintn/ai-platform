import { Button, cn, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import type { OpinionMode } from "@ngriffin_uk/polychat-library-chat/opinion";
import type { ModelCatalogItem } from "@ngriffin_uk/polychat-schemas";
import { CheckCircle2, MessageSquareQuote, Scale } from "lucide-react";

import { ConversationModelOption } from "./Selector/ConversationModelOption";

export interface OpinionModelPickerProps {
  mode: OpinionMode;
  onModeChange: (mode: OpinionMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  featuredModels: ModelCatalogItem[];
  searchResults: ModelCatalogItem[];
  selectedModelIds: string[];
  onToggleModel: (modelId: string) => void;
  maxConsensusModels: number;
  isLoading?: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  className?: string;
}

export function OpinionModelPicker({
  mode,
  onModeChange,
  searchQuery,
  onSearchQueryChange,
  featuredModels,
  searchResults,
  selectedModelIds,
  onToggleModel,
  maxConsensusModels,
  isLoading = false,
  submitDisabled,
  onSubmit,
  onCancel,
  className,
}: OpinionModelPickerProps) {
  const isSearching = searchQuery.trim().length > 0;
  const visibleSearchResults = isSearching ? searchResults : [];

  return (
    <div className={cn("w-full overflow-hidden rounded-lg bg-white dark:bg-zinc-900", className)}>
      <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => onModeChange("second-opinion")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              mode === "second-opinion"
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
            Second opinion
          </button>
          <button
            type="button"
            onClick={() => onModeChange("consensus")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              mode === "consensus"
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <Scale className="h-3.5 w-3.5" aria-hidden />
            Consensus
          </button>
        </div>
        <div className="mt-2">
          <SearchInput
            value={searchQuery}
            onChange={onSearchQueryChange}
            placeholder="Search models"
            className="[&_input]:py-1.5 [&_input]:text-sm"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-2 sm:max-h-80">
        {isLoading && (
          <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">Loading models...</p>
        )}
        {isSearching && (
          <div>
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Search Results
            </div>
            {visibleSearchResults.length > 0 ? (
              visibleSearchResults.map((modelItem) => (
                <ConversationModelOption
                  key={modelItem.id}
                  model={modelItem}
                  isSelected={selectedModelIds.includes(modelItem.id)}
                  isDisabled={
                    mode === "consensus" &&
                    !selectedModelIds.includes(modelItem.id) &&
                    selectedModelIds.length >= maxConsensusModels
                  }
                  onSelect={onToggleModel}
                  showCheckbox
                />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-zinc-300 px-2 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No matching models.
              </p>
            )}
          </div>
        )}
        {featuredModels.length > 0 && (
          <div className={isSearching ? "mt-3" : ""}>
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Featured Models
            </div>
            {featuredModels.map((modelItem) => (
              <ConversationModelOption
                key={modelItem.id}
                model={modelItem}
                isSelected={selectedModelIds.includes(modelItem.id)}
                isDisabled={
                  mode === "consensus" &&
                  !selectedModelIds.includes(modelItem.id) &&
                  selectedModelIds.length >= maxConsensusModels
                }
                onSelect={onToggleModel}
                showCheckbox
              />
            ))}
          </div>
        )}
        {!isLoading && !isSearching && featuredModels.length === 0 && (
          <p className="rounded-md border border-dashed border-zinc-300 px-2 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No opinion models are available.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 p-2 dark:border-zinc-700">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {selectedModelIds.length || 0} selected
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="xs"
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {mode === "consensus" ? "Ask for consensus" : "Ask for opinion"}
          </Button>
        </div>
      </div>
    </div>
  );
}
