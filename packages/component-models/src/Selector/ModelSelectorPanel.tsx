import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ngriffin_uk/polychat-component-ui";
import type {
  ChatMode,
  ModelCatalogItem,
  ModelConfigItem,
  ModelLineupRuntime,
  ModelModality,
  ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { Cloud, Computer, Filter, Gauge, Search, Server } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";

import { ModelsList } from "./ModelsList";
import { ModelTierPicker, type ModelTierSelection } from "./ModelTierPicker";

export type ModelSelectorTab = "tiers" | "models";

export interface ModelSelectorPanelLayout {
  left: number;
  width: number;
}

export interface ModelSelectorPanelProps {
  panelRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  layout: ModelSelectorPanelLayout | null;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;

  selectedTab: ModelSelectorTab;
  onTabChange: (tab: ModelSelectorTab) => void;
  showTiersTab: boolean;

  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  capabilities: ModelModality[];
  selectedCapability: ModelModality | null;
  onCapabilityChange: (capability: ModelModality | null) => void;

  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;

  tierModels: ModelConfigItem[];
  tierRuntime: ModelLineupRuntime;
  modelTier: ModelTier | null;
  onModelTierChange: (selection: ModelTierSelection) => void;

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
}

export function ModelSelectorPanel({
  panelRef,
  searchInputRef,
  layout,
  onKeyDown,
  selectedTab,
  onTabChange,
  showTiersTab,
  searchQuery,
  onSearchQueryChange,
  capabilities,
  selectedCapability,
  onCapabilityChange,
  chatMode,
  onChatModeChange,
  tierModels,
  tierRuntime,
  modelTier,
  onModelTierChange,
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
}: ModelSelectorPanelProps) {
  const showModelSource = Boolean(chatMode && onChatModeChange);

  return (
    <div
      ref={panelRef}
      onKeyDown={onKeyDown}
      role="dialog"
      tabIndex={-1}
      aria-modal="false"
      style={layout ? { left: `${layout.left}px`, width: `${layout.width}px` } : undefined}
      className="absolute bottom-full left-0 z-50 mb-1 flex max-h-[70vh] w-[min(96vw,600px)] max-w-[600px] flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[var(--polychat-elevated-shadow)] sm:max-h-[75vh] sm:w-[min(90vw,660px)] sm:max-w-[660px]"
      aria-label="Model selection dialog"
    >
      {selectedTab === "models" && (
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
      )}

      <Tabs
        value={selectedTab}
        onValueChange={(value) => {
          const tab = value as ModelSelectorTab;

          if (!showTiersTab && tab !== "models") {
            return;
          }

          onTabChange(tab);
        }}
        className="min-h-0 flex-1 px-2 pt-2 pb-2"
      >
        {showTiersTab && (
          <>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
              <TabsTrigger value="tiers" className="min-w-0 px-2 py-2 text-xs sm:text-sm">
                <Gauge className="h-4 w-4" />
                Tiers
              </TabsTrigger>
              <TabsTrigger value="models" className="min-w-0 px-2 py-2 text-xs sm:text-sm">
                <Server className="h-4 w-4" />
                Models
              </TabsTrigger>
            </TabsList>
            <div className="w-full border-b border-border" />

            <TabsContent value="tiers" className="min-h-0 overflow-y-auto">
              <ModelTierPicker
                models={tierModels}
                runtime={tierRuntime}
                selectedTier={modelTier}
                allowInherit={tierRuntime === "hosted"}
                disabled={isDisabled || isModelLocked}
                onSelectTier={onModelTierChange}
              />
            </TabsContent>
          </>
        )}

        <TabsContent value="models" className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {showModelSource && (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">Model Source:</div>
                  <div className="inline-flex items-center rounded-md bg-surface p-0.5">
                    <button
                      type="button"
                      className={`flex cursor-pointer items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                        chatMode === "remote"
                          ? "bg-selection text-foreground"
                          : "text-muted-foreground hover:bg-selection/60 hover:text-foreground"
                      }`}
                      onClick={() => chatMode !== "remote" && onChatModeChange?.("remote")}
                      aria-pressed={chatMode === "remote"}
                    >
                      <Cloud className="h-3 w-3" />
                      Remote
                    </button>
                    <button
                      type="button"
                      className={`flex cursor-pointer items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                        chatMode === "local"
                          ? "bg-selection text-foreground"
                          : "text-muted-foreground hover:bg-selection/60 hover:text-foreground"
                      }`}
                      onClick={() => chatMode !== "local" && onChatModeChange?.("local")}
                      aria-pressed={chatMode === "local"}
                    >
                      <Computer className="h-3 w-3" />
                      Local
                    </button>
                  </div>
                </div>
              </div>
            )}

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
        </TabsContent>
      </Tabs>
    </div>
  );
}
