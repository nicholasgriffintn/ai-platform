import { Filter, Search, X } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { FormInput } from "~/components/ui/Form/Input";
import { FormSelect } from "~/components/ui/Form/Select";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { useMarketplaceStore } from "~/state/stores/marketplaceStore";

interface MarketplaceFiltersProps {
  categories: string[];
  tags: string[];
  className?: string;
}

export function MarketplaceFilters({
  categories,
  tags,
  className,
}: MarketplaceFiltersProps) {
  const {
    searchQuery,
    selectedCategory,
    selectedTags,
    sortBy,
    showFilters,
    setSearchQuery,
    setCategory,
    toggleTag,
    setSortBy,
    clearFilters,
    toggleFilters,
  } = useMarketplaceStore();

  const hasActiveFilters =
    searchQuery ||
    selectedCategory ||
    selectedTags.length > 0 ||
    sortBy !== "popular";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <FormInput
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchQuery(e.target.value)
          }
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFilters}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              !
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Filter Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sort */}
            <div className="space-y-2">
              <FormSelect
                label="Sort by"
                value={sortBy}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSortBy(
                    e.target.value as "popular" | "recent" | "rating" | "name",
                  )
                }
                options={[
                  { value: "popular", label: "Most Popular" },
                  { value: "recent", label: "Recently Added" },
                  { value: "rating", label: "Highest Rated" },
                  { value: "name", label: "Name (A-Z)" },
                ]}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <FormSelect
                label="Category"
                value={selectedCategory || ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setCategory(e.target.value || null)
                }
                options={[
                  { value: "", label: "All categories" },
                  ...categories.map((category) => ({
                    value: category,
                    label: category,
                  })),
                ]}
              />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {tags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-primary/80",
                          isSelected && "bg-primary text-primary-foreground",
                        )}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Active Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedCategory && (
                    <Badge
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-secondary/80"
                      onClick={() => setCategory(null)}
                    >
                      Category: {selectedCategory}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-secondary/80"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                  {sortBy !== "popular" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-secondary/80"
                      onClick={() => setSortBy("popular")}
                    >
                      Sort: {sortBy}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
