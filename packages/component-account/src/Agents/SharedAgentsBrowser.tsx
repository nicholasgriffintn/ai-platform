import {
  CardGridLoadingSkeleton,
  EmptyState,
  FormSelect,
  SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import type { SharedAgentSummary } from "@ngriffin_uk/polychat-schemas";
import { SearchX, Star } from "lucide-react";

import { SharedAgentCard } from "./SharedAgentCard";

export interface SharedAgentsBrowserProps {
  searchTerm: string;
  onSearchTermChange: (searchTerm: string) => void;
  selectedCategory: string;
  onSelectedCategoryChange: (category: string) => void;
  selectedTag: string;
  onSelectedTagChange: (tag: string) => void;
  categories: string[];
  tags: string[];
  sharedAgents: SharedAgentSummary[];
  featuredAgents: SharedAgentSummary[];
  isLoadingSharedAgents: boolean;
  isLoadingFeaturedAgents: boolean;
  onInstall: (sharedAgentId: string) => void;
  installingAgentId?: string;
  isInstalling: boolean;
}

export function SharedAgentsBrowser({
  searchTerm,
  onSearchTermChange,
  selectedCategory,
  onSelectedCategoryChange,
  selectedTag,
  onSelectedTagChange,
  categories,
  tags,
  sharedAgents,
  featuredAgents,
  isLoadingSharedAgents,
  isLoadingFeaturedAgents,
  onInstall,
  installingAgentId,
  isInstalling,
}: SharedAgentsBrowserProps) {
  const isFiltering = Boolean(searchTerm || selectedCategory || selectedTag);
  const showFeatured = !isFiltering && (isLoadingFeaturedAgents || featuredAgents.length > 0);

  const renderCard = (agent: SharedAgentSummary) => (
    <SharedAgentCard
      key={agent.id}
      agent={agent}
      onInstall={onInstall}
      isInstalling={isInstalling && installingAgentId === agent.id}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          aria-label="Search shared agents"
          className="flex-1"
          placeholder="Search shared agents..."
          value={searchTerm}
          onChange={onSearchTermChange}
        />
        <div className="flex gap-2">
          <FormSelect
            aria-label="Filter shared agents by category"
            className="h-10 min-w-36 bg-white dark:bg-zinc-900"
            value={selectedCategory}
            onChange={(event) => onSelectedCategoryChange(event.target.value)}
            options={[
              { value: "", label: "All categories" },
              ...categories.map((category) => ({ value: category, label: category })),
            ]}
          />
          <FormSelect
            aria-label="Filter shared agents by tag"
            className="h-10 min-w-32 bg-white dark:bg-zinc-900"
            value={selectedTag}
            onChange={(event) => onSelectedTagChange(event.target.value)}
            options={[
              { value: "", label: "All tags" },
              ...tags.map((tag) => ({ value: tag, label: tag })),
            ]}
          />
        </div>
      </div>

      {showFeatured && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            Featured
          </h3>
          {isLoadingFeaturedAgents ? (
            <CardGridLoadingSkeleton count={3} label="Loading featured agents" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featuredAgents.map(renderCard)}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {isFiltering ? "Results" : "All shared agents"}
        </h3>
        {isLoadingSharedAgents ? (
          <CardGridLoadingSkeleton count={3} label="Loading shared agents" />
        ) : sharedAgents.length === 0 ? (
          <EmptyState
            icon={<SearchX size={24} className="text-zinc-400" />}
            title="No shared agents found"
            message="Try another search, category, or tag."
            className="min-h-[200px]"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sharedAgents.map(renderCard)}
          </div>
        )}
      </section>
    </div>
  );
}
