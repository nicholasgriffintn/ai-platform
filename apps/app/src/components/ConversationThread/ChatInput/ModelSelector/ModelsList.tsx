import { ChevronDown, ChevronUp } from "lucide-react";

import type { ModelConfigItem } from "~/types";
import { ModelOption } from "./ModelOption";

interface ModelsListProps {
  featured: Record<string, ModelConfigItem[]>;
  other: Record<string, ModelConfigItem[]>;
  showAll: boolean;
  setShowAll: (show: boolean) => void;
  showAllDisabled: boolean;
  isDisabled?: boolean;
  isPro: boolean;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  mono?: boolean;
}

export function ModelsList({
  featured,
  other,
  showAll,
  setShowAll,
  showAllDisabled,
  isDisabled,
  isPro,
  selectedId,
  onSelect,
  mono,
}: ModelsListProps) {
  return (
    <>
      {Object.keys(featured).length > 0 && (
        <div className="border-b border-zinc-200 dark:border-zinc-700">
          <fieldset aria-labelledby="featured-models-heading">
            {Object.entries(featured)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([provider, models]) => (
                <div key={provider} className="mb-2">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </div>
                  {models.map((m) => {
                    const disabledOption = isDisabled || (!isPro && !m.isFree);
                    return (
                      <ModelOption
                        key={m.matchingModel}
                        model={m}
                        isSelected={m.id === selectedId}
                        onClick={() => onSelect(m.id)}
                        disabled={disabledOption}
                        isActive={false}
                        mono={mono}
                      />
                    );
                  })}
                </div>
              ))}
          </fieldset>
        </div>
      )}

      {Object.keys(other).length > 0 && (
        <div className="p-2">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="cursor-pointer flex items-center justify-between w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
            disabled={showAllDisabled}
            aria-expanded={showAll}
            aria-controls="other-models-section"
          >
            <span>
              Other Models {`(${Object.values(other).flat().length})`}
            </span>
            {showAll ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showAll && (
            <div id="other-models-section">
              {Object.entries(other)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([provider, models]) => (
                  <div key={provider} className="mb-2">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </div>
                    {models.map((m) => {
                      const disabledOption =
                        isDisabled || (!isPro && !m.isFree);
                      return (
                        <ModelOption
                          key={m.matchingModel}
                          model={m}
                          isSelected={m.id === selectedId}
                          onClick={() => onSelect(m.id)}
                          disabled={disabledOption}
                          isActive={false}
                          mono={mono}
                        />
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
