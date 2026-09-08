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
import type { KeyboardEvent, RefObject } from "react";

import { ModelsList } from "./ModelsList";
import { ModelTierPicker, type ModelTierSelection } from "./ModelTierPicker";
import { RuntimeRail, type RuntimeRailOption } from "./RuntimeRail";

export interface ModelSelectorPanelLayout {
  left: number;
  width: number;
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

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
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
  retention = "kept",
  retentionReason = "chosen",
  onRetentionChange,
  isRetentionLocked,
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
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tierIndex = Number.parseInt(event.key, 10) - 1;

    if (
      showTiers &&
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
      style={layout ? { left: `${layout.left}px`, width: `${layout.width}px` } : undefined}
      className="absolute bottom-full left-0 z-50 mb-1 flex max-h-[80vh] w-[min(96vw,600px)] max-w-[600px] flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[var(--polychat-elevated-shadow)] sm:w-[min(90vw,660px)] sm:max-w-[660px]"
      aria-label="Model selection dialog"
    >
      {runtimeOptions && selectedComputeSite && onComputeSiteChange && (
        <div className="border-b border-border p-2">
          <RuntimeRail
            options={runtimeOptions}
            selected={selectedComputeSite}
            selectedMachineId={selectedMachineId}
            onSelect={onComputeSiteChange}
          />
        </div>
      )}

      {showTiers && (
        <section
          aria-label="Model tiers"
          className="max-h-[19rem] overflow-y-auto border-b border-border"
        >
          <ModelTierPicker
            resolved={tierLineup}
            runtime={selectedComputeSite ?? "hosted"}
            selectedTier={modelTier}
            allowInherit={selectedComputeSite === "hosted"}
            disabled={isDisabled || isModelLocked}
            onSelectTier={onModelTierChange}
          />
        </section>
      )}

      <div className="border-b border-border p-2">
        <div className="flex flex-col gap-2 sm:flex-row">
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
          <div className="relative sm:w-48">
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
              <option value="">All model types</option>
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

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
