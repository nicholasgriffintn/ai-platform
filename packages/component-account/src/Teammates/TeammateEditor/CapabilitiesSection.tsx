import {
  CapabilityFilters,
  type CapabilityFilter,
} from "@ngriffin_uk/polychat-component-capabilities";
import type { SkillSummary, Tool } from "@ngriffin_uk/polychat-schemas";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import {
  TEAMMATE_CAPABILITY_FILTERS,
  type TeammateCapabilityOption,
  filterTeammateCapabilityOptions,
  getTeammateCapabilityCategories,
  toTeammateCapabilityOptions,
} from "./capability-selection";
import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface CapabilitiesSectionProps {
  value: Pick<TeammateEditorValue, "toolIds" | "skillIds">;
  tools: Tool[];
  skills: SkillSummary[];
  isLoading: boolean;
  disabled: boolean;
  onChange: TeammateEditorChange;
}

function toggle(ids: string[], id: string, selected: boolean): string[] {
  return selected ? [...ids, id] : ids.filter((entry) => entry !== id);
}

export function CapabilitiesSection({
  value,
  tools,
  skills,
  isLoading,
  disabled,
  onChange,
}: CapabilitiesSectionProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [filters, setFilters] = useState<CapabilityFilter[]>([]);

  const options = toTeammateCapabilityOptions(tools, skills);
  const visibleOptions = filterTeammateCapabilityOptions(options, { category, filters, query });
  const selectedCount = value.toolIds.length + value.skillIds.length;

  const isSelected = (option: TeammateCapabilityOption) =>
    option.kind === "tool" ? value.toolIds.includes(option.id) : value.skillIds.includes(option.id);

  const select = (option: TeammateCapabilityOption, selected: boolean) => {
    onChange(
      option.kind === "tool"
        ? { toolIds: toggle(value.toolIds, option.id, selected) }
        : { skillIds: toggle(value.skillIds, option.id, selected) },
    );
  };

  return (
    <TeammateEditorSection
      title="Capabilities"
      description={`Tools the teammate may call and skills it loads. ${selectedCount} selected.`}
    >
      <CapabilityFilters
        availableFilters={TEAMMATE_CAPABILITY_FILTERS}
        categories={getTeammateCapabilityCategories(options)}
        category={category}
        filters={filters}
        query={query}
        searchPlaceholder="Search tools and skills..."
        onCategoryChange={setCategory}
        onFiltersChange={(next) => {
          setFilters(next);
          setCategory("all");
        }}
        onQueryChange={setQuery}
      />

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : visibleOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border p-3">
          {visibleOptions.map((option) => (
            <label
              key={`${option.kind}:${option.id}`}
              className="flex cursor-pointer items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={isSelected(option)}
                disabled={disabled}
                onChange={(event) => select(option, event.target.checked)}
              />
              <span>
                <span className="font-medium">{option.name}</span>
                <span className="ml-2 text-xs text-muted-foreground uppercase">{option.kind}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </TeammateEditorSection>
  );
}
