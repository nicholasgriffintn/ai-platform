import { SearchInput, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ToolCategoryFilter } from "@ngriffin_uk/polychat-library-chat/tool-filters";
import type { ToolCategory } from "@ngriffin_uk/polychat-schemas";

interface ToolSelectorFiltersProps {
  categories: ToolCategory[];
  category: ToolCategoryFilter;
  onCategoryChange: (category: ToolCategoryFilter) => void;
  onQueryChange: (query: string) => void;
  query: string;
}

export function ToolSelectorFilters({
  categories,
  category,
  onCategoryChange,
  onQueryChange,
  query,
}: ToolSelectorFiltersProps) {
  const filters: Array<{ label: string; value: ToolCategoryFilter }> = [
    { label: "All", value: "all" },
    { label: "Selected", value: "selected" },
    ...categories.map((toolCategory) => ({
      label: toolCategory,
      value: toolCategory,
    })),
  ];

  return (
    <div className="space-y-2 px-1">
      <SearchInput
        aria-label="Search tools"
        autoComplete="off"
        autoFocus
        className="w-full"
        onChange={onQueryChange}
        placeholder="Search tools..."
        value={query}
      />
      <div
        aria-label="Filter tools by category"
        className="flex gap-1.5 overflow-x-auto pb-1"
        role="group"
      >
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={category === filter.value}
            onClick={() => onCategoryChange(filter.value)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              category === filter.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
