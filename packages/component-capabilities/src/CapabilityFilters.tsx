import { FormSelect, SearchInput } from "@ngriffin_uk/polychat-component-ui";

export type CapabilityKind = "app" | "recipe" | "skill" | "tool" | "teammate";
export type CapabilityFilter = "configured" | CapabilityKind;

export interface CapabilityFiltersProps {
  categories: string[];
  category: string;
  filters: CapabilityFilter[];
  query: string;
  availableFilters?: CapabilityFilter[];
  searchPlaceholder?: string;
  onCategoryChange: (category: string) => void;
  onFiltersChange: (filters: CapabilityFilter[]) => void;
  onQueryChange: (query: string) => void;
}

const capabilityFilters: Array<{ label: string; value: CapabilityFilter }> = [
  { label: "Configured", value: "configured" },
  { label: "Teammates", value: "teammate" },
  { label: "Apps", value: "app" },
  { label: "Automations", value: "recipe" },
  { label: "Skills", value: "skill" },
  { label: "Tools", value: "tool" },
];

export function CapabilityFilters({
  categories,
  category,
  filters,
  query,
  availableFilters,
  searchPlaceholder = "Search apps, recipes, and tools...",
  onCategoryChange,
  onFiltersChange,
  onQueryChange,
}: CapabilityFiltersProps) {
  const categoryFilters = [
    { label: "All categories", value: "all" },
    ...categories.map((value) => ({ label: value, value })),
  ];
  const visibleFilters = availableFilters
    ? capabilityFilters.filter((filter) => availableFilters.includes(filter.value))
    : capabilityFilters;

  return (
    <div className="mb-8 space-y-4">
      <SearchInput
        aria-label="Search capabilities"
        className="max-w-xl"
        placeholder={searchPlaceholder}
        value={query}
        onChange={onQueryChange}
      />
      <div className="space-y-3">
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
          <legend className="sr-only">Filter capabilities</legend>
          <button
            type="button"
            aria-pressed={filters.length === 0}
            onClick={() => onFiltersChange([])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.length === 0
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
            }`}
          >
            All
          </button>
          {visibleFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={filters.includes(filter.value)}
              onClick={() =>
                onFiltersChange(
                  filters.includes(filter.value)
                    ? filters.filter((value) => value !== filter.value)
                    : [...filters, filter.value],
                )
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.includes(filter.value)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </fieldset>
        <div className="mt-4 sm:hidden">
          <FormSelect
            aria-label="Filter capabilities by category"
            onValueChange={onCategoryChange}
            options={categoryFilters}
            value={category}
          />
        </div>
        <fieldset className="m-0 mt-4 hidden min-w-0 flex-wrap gap-1.5 border-0 p-0 sm:flex">
          <legend className="sr-only">Filter capabilities by category</legend>
          {categoryFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={category === filter.value}
              onClick={() => onCategoryChange(filter.value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                category === filter.value
                  ? "border-border-strong bg-surface-elevated text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-surface-elevated"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
