import {
  Button,
  OptionsMenu,
  OptionsMenuSection,
  SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import { ListFilter } from "lucide-react";

export type CapabilityKind = "app" | "connector" | "recipe" | "skill" | "tool" | "teammate";

export interface CapabilityFiltersProps {
  kinds?: readonly CapabilityKind[];
  kind?: CapabilityKind | null;
  installed?: boolean;
  categories: string[];
  category: string;
  query: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  onKindChange?: (kind: CapabilityKind) => void;
  onInstalledChange?: (installed: boolean) => void;
  onCategoryChange: (category: string) => void;
  onQueryChange: (query: string) => void;
}

const KIND_LABELS: Record<CapabilityKind, string> = {
  connector: "Integrations",
  teammate: "Teammates",
  app: "Apps",
  recipe: "Automations",
  skill: "Skills",
  tool: "Tools",
};

const NO_KINDS: readonly CapabilityKind[] = [];

const SHOW_OPTIONS = [
  { value: "everything", label: "Everything" },
  { value: "installed", label: "Installed" },
] as const;

export function CapabilityFilters({
  kinds = NO_KINDS,
  kind = null,
  installed = false,
  categories,
  category,
  query,
  searchLabel = "Search capabilities",
  searchPlaceholder = "Search apps, recipes, and tools...",
  onKindChange,
  onInstalledChange,
  onCategoryChange,
  onQueryChange,
}: CapabilityFiltersProps) {
  const categoryOptions = [
    { value: "all", label: "Any category" },
    ...categories.map((value) => ({ value, label: value })),
  ];
  const isFiltered = installed || category !== "all";

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {onKindChange && kinds.length > 0 ? (
        <nav aria-label="Capability types" className="w-full sm:mr-auto sm:w-auto">
          <ul className="flex flex-wrap gap-1">
            {kinds.map((value) => (
              <li key={value}>
                <Button
                  variant={value === kind && !installed ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  aria-pressed={value === kind && !installed}
                  onClick={() => onKindChange(value)}
                >
                  {KIND_LABELS[value]}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <span className="hidden sm:mr-auto sm:block" />
      )}
      <SearchInput
        aria-label={searchLabel}
        className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        placeholder={searchPlaceholder}
        value={query}
        onChange={onQueryChange}
      />
      <OptionsMenu
        align="end"
        trigger={
          <Button
            variant={isFiltered ? "secondary" : "icon"}
            size="icon"
            icon={<ListFilter size={16} />}
            aria-label={isFiltered ? "Filters applied" : "Filter"}
          />
        }
      >
        {onInstalledChange ? (
          <OptionsMenuSection
            label="Show"
            value={installed ? "installed" : "everything"}
            options={SHOW_OPTIONS}
            onChange={(value) => onInstalledChange(value === "installed")}
          />
        ) : null}
        <OptionsMenuSection
          label="Category"
          value={category}
          options={categoryOptions}
          onChange={onCategoryChange}
        />
      </OptionsMenu>
    </div>
  );
}
