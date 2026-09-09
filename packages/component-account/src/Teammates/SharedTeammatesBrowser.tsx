import {
  CardGridLoadingSkeleton,
  EmptyState,
  FormSelect,
  SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import type { SharedTeammateSummary } from "@ngriffin_uk/polychat-schemas";
import { SearchX, Star } from "lucide-react";

import { SharedTeammateCard } from "./SharedTeammateCard";

export interface SharedTeammatesBrowserProps {
  searchTerm: string;
  onSearchTermChange: (searchTerm: string) => void;
  selectedCategory: string;
  onSelectedCategoryChange: (category: string) => void;
  selectedTag: string;
  onSelectedTagChange: (tag: string) => void;
  categories: string[];
  tags: string[];
  sharedTeammates: SharedTeammateSummary[];
  featuredTeammates: SharedTeammateSummary[];
  isLoadingSharedTeammates: boolean;
  isLoadingFeaturedTeammates: boolean;
  onInstall: (sharedTeammateId: string) => void;
  installingTeammateId?: string;
  isInstalling: boolean;
}

export function SharedTeammatesBrowser({
  searchTerm,
  onSearchTermChange,
  selectedCategory,
  onSelectedCategoryChange,
  selectedTag,
  onSelectedTagChange,
  categories,
  tags,
  sharedTeammates,
  featuredTeammates,
  isLoadingSharedTeammates,
  isLoadingFeaturedTeammates,
  onInstall,
  installingTeammateId,
  isInstalling,
}: SharedTeammatesBrowserProps) {
  const isFiltering = Boolean(searchTerm || selectedCategory || selectedTag);
  const showFeatured = !isFiltering && (isLoadingFeaturedTeammates || featuredTeammates.length > 0);

  const renderCard = (teammate: SharedTeammateSummary) => (
    <SharedTeammateCard
      key={teammate.id}
      teammate={teammate}
      onInstall={onInstall}
      isInstalling={isInstalling && installingTeammateId === teammate.id}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          aria-label="Search shared teammates"
          className="flex-1"
          placeholder="Search shared teammates..."
          value={searchTerm}
          onChange={onSearchTermChange}
        />
        <div className="flex gap-2">
          <FormSelect
            aria-label="Filter shared teammates by category"
            className="min-w-36"
            fullWidth={false}
            value={selectedCategory}
            onValueChange={onSelectedCategoryChange}
            options={[
              { value: "", label: "All categories" },
              ...categories.map((category) => ({ value: category, label: category })),
            ]}
          />
          <FormSelect
            aria-label="Filter shared teammates by tag"
            className="min-w-32"
            fullWidth={false}
            value={selectedTag}
            onValueChange={onSelectedTagChange}
            options={[
              { value: "", label: "All tags" },
              ...tags.map((tag) => ({ value: tag, label: tag })),
            ]}
          />
        </div>
      </div>

      {showFeatured && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Star size={14} className="fill-attention text-attention" />
            Featured
          </h3>
          {isLoadingFeaturedTeammates ? (
            <CardGridLoadingSkeleton count={3} label="Loading featured teammates" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featuredTeammates.map(renderCard)}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {isFiltering ? "Results" : "All shared teammates"}
        </h3>
        {isLoadingSharedTeammates ? (
          <CardGridLoadingSkeleton count={3} label="Loading shared teammates" />
        ) : sharedTeammates.length === 0 ? (
          <EmptyState
            icon={<SearchX size={24} className="text-muted-foreground" />}
            title="No shared teammates found"
            message="Try another search, category, or tag."
            className="min-h-[200px]"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sharedTeammates.map(renderCard)}
          </div>
        )}
      </section>
    </div>
  );
}
