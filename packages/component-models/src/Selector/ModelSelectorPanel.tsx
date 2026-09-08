import { Button } from "@ngriffin_uk/polychat-component-ui";
import type {
  ComputeSite,
  ConversationRetention,
  ModelCatalogItem,
  ModelConfigItem,
  ModelModality,
  ModelTier,
  ModelTierLineup,
  RetentionReason,
} from "@ngriffin_uk/polychat-schemas";
import { MODEL_TIER_DEFINITIONS } from "@ngriffin_uk/polychat-schemas";
import { CircleHelp, Filter, Search } from "lucide-react";
import { useState, type KeyboardEvent, type RefObject } from "react";

import { isTextEntryTarget } from "../lib/event-target";
import { ModelsList } from "./ModelsList";
import { ModelTierPicker, type ModelTierSelection } from "./ModelTierPicker";
import type { RuntimeRailOption } from "./RuntimeRail";

export interface ModelSelectorPanelLayout {
  left: number;
  width: number;
  maxHeight?: number;
}

export interface ModelSelectorPanelProps {
  panelRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  layout: ModelSelectorPanelLayout | null;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;

  runtimeOptions?: RuntimeRailOption[];
  selectedComputeSite?: ComputeSite;
  selectedMachineId?: string;
  onComputeSiteChange?: (computeSite: ComputeSite, machineId?: string) => void;

  showTiers: boolean;
  tierLineup?: ModelTierLineup;
  modelTier: ModelTier | null;
  onModelTierChange: (selection: ModelTierSelection) => void;
  onTierShortcut?: (tier: ModelTier) => void;

  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  capabilities: ModelModality[];
  selectedCapability: ModelModality | null;
  onCapabilityChange: (capability: ModelModality | null) => void;

  retention?: ConversationRetention;
  retentionReason?: RetentionReason;
  onRetentionChange?: (retention: ConversationRetention) => void;
  isRetentionLocked?: boolean;

  models: ModelCatalogItem[];
  featuredModelIds: Record<string, ModelCatalogItem>;
  isDisabled?: boolean;
  isModelLocked?: boolean;
  isPro: boolean;
  mono?: boolean;
  selectedModelId?: string;
  onModelSelect: (id: string, model: ModelCatalogItem) => void;
  onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
  onInfoHoverEnd?: () => void;
  onOpenModelSources?: () => void;
}

export function ModelSelectorPanel({
  panelRef,
  searchInputRef,
  layout,
  onKeyDown,
  runtimeOptions,
  selectedComputeSite,
  selectedMachineId,
  onComputeSiteChange,
  showTiers,
  tierLineup,
  modelTier,
  onModelTierChange,
  onTierShortcut,
  searchQuery,
  onSearchQueryChange,
  capabilities,
  selectedCapability,
  onCapabilityChange,
  models,
  featuredModelIds,
  isDisabled,
  isModelLocked = false,
  isPro,
  mono,
  selectedModelId,
  onModelSelect,
  onInfoHoverStart,
  onInfoHoverEnd,
  onOpenModelSources,
}: ModelSelectorPanelProps) {
  const [selectionView, setSelectionView] = useState(selectedModelId ? "models" : "auto");
  const showAuto = showTiers && selectionView === "auto";
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tierIndex = Number.parseInt(event.key, 10) - 1;

    if (
      showAuto &&
      !isTextEntryTarget(event.target) &&
      tierIndex >= 0 &&
      tierIndex < MODEL_TIER_DEFINITIONS.length
    ) {
      event.preventDefault();
      onTierShortcut?.(MODEL_TIER_DEFINITIONS[tierIndex].id);

      return;
    }

    onKeyDown(event);
  };

  return (
    <div
      ref={panelRef}
      onKeyDown={handleKeyDown}
      role="dialog"
      tabIndex={-1}
      aria-modal="false"
      style={
        layout
          ? {
              left: layout.left,
              width: layout.width,
              maxHeight: layout.maxHeight,
              animation: "none",
              transition: "none",
            }
          : { animation: "none", transition: "none" }
      }
      className="absolute bottom-full left-0 z-50 mb-2 flex max-h-[80dvh] w-[min(660px,calc(100vw-16px))] origin-bottom-left flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[var(--polychat-elevated-shadow)]"
      aria-label="Model selection dialog"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
        {runtimeOptions && selectedComputeSite && onComputeSiteChange && (
          <select
            aria-label="Model source"
            value={`${selectedComputeSite}:${selectedMachineId ?? ""}`}
            onChange={(event) => {
              const option = runtimeOptions.find(
                (option) => `${option.site}:${option.machineId ?? ""}` === event.target.value,
              );

              if (option) {
                onComputeSiteChange(option.site, option.machineId);
              }
            }}
            className="max-w-[50%] min-w-0 rounded-md bg-transparent py-1 pr-2 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-active-work"
          >
            {runtimeOptions.map((option) => (
              <option
                key={`${option.site}:${option.machineId ?? ""}`}
                value={`${option.site}:${option.machineId ?? ""}`}
              >
                {option.label}
              </option>
            ))}
          </select>
        )}
        {showTiers && (
          <div
            className="flex rounded-md bg-surface p-0.5"
            role="group"
            aria-label="Model selection mode"
          >
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs ${showAuto ? "bg-selection text-foreground" : "text-muted-foreground"}`}
              onClick={() => setSelectionView("auto")}
              aria-pressed={showAuto}
            >
              Auto
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs ${!showAuto ? "bg-selection text-foreground" : "text-muted-foreground"}`}
              onClick={() => {
                setSelectionView("models");
              }}
              aria-pressed={!showAuto}
            >
              Models
            </button>
          </div>
        )}
      </div>
      {showAuto && (
        <section aria-label="Model tiers" className="min-h-0 overflow-y-auto">
          <ModelTierPicker
            resolved={tierLineup}
            runtime={selectedComputeSite ?? "hosted"}
            selectedTier={modelTier}
            active={!selectedModelId}
            allowInherit={selectedComputeSite === "hosted"}
            disabled={isDisabled || isModelLocked}
            onSelectTier={onModelTierChange}
          />
        </section>
      )}

      {!showAuto && (
        <>
          <div className="border-b border-border p-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-active-work focus:outline-none"
                  aria-label="Search models"
                />
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <div className="relative w-36">
                <select
                  value={selectedCapability || ""}
                  onChange={(event) => {
                    const nextCapability =
                      capabilities.find((capability) => capability === event.target.value) ?? null;

                    onCapabilityChange(nextCapability);
                  }}
                  className="w-full appearance-none rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-sm text-foreground focus:border-active-work focus:outline-none"
                  aria-label="Filter by model type"
                >
                  <option value="">All types</option>
                  {capabilities.map((capability) => (
                    <option key={capability} value={capability}>
                      {capability}
                    </option>
                  ))}
                </select>
                <Filter
                  className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2">
            <ModelsList
              disabled={isModelLocked}
              models={models}
              featuredModelIds={featuredModelIds}
              isDisabled={isDisabled}
              isPro={isPro}
              selectedId={selectedModelId}
              onSelect={onModelSelect}
              mono={mono}
              isSearchActive={searchQuery.trim().length > 0}
              onInfoHoverStart={onInfoHoverStart}
              onInfoHoverEnd={onInfoHoverEnd}
            />
          </div>
        </>
      )}

      {onOpenModelSources && (
        <div className="border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            icon={<CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onOpenModelSources}
          >
            How models work here
          </Button>
        </div>
      )}
    </div>
  );
}
