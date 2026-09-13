import {
  ModelHoverPreview,
  ModelSelectorPanel,
  ModelSelectorTrigger,
  getModelTierIcon,
} from "@ngriffin_uk/polychat-component-models";
import { ShortcutTooltip } from "@ngriffin_uk/polychat-component-ui";
import type { ModelSelectionState, ModelTierSelection } from "@ngriffin_uk/polychat-library-react";
import { createElement } from "react";

import type { ModelSelectorController } from "./useModelSelectorController.js";

interface ModelSelectorViewProps {
  controller: ModelSelectorController;
  isDisabled?: boolean;
  minimal: boolean;
  mono: boolean;
  selection: ModelSelectionState;
}

export function ModelSelectorView({
  controller,
  isDisabled,
  minimal,
  mono,
  selection,
}: ModelSelectorViewProps) {
  const {
    attachTriggerWrapper,
    cancelHoverPreviewDismiss,
    closeSelector,
    dropdownRef,
    handleInfoHoverEnd,
    handleInfoHoverStart,
    handleKeyDown,
    hoverPreview,
    hoverPreviewRef,
    panelLayout,
    searchInputRef,
    toggleSelector,
    triggerRef,
  } = controller;
  const SelectedTierIcon = getModelTierIcon(selection.modelTier);

  const handleModelSelect = (id: string) => {
    if (selection.selectModel(id)) {
      closeSelector();
    }
  };

  const handleTierSelect = (tierSelection: ModelTierSelection) => {
    selection.selectTier(tierSelection);
    closeSelector();
  };

  return (
    <div ref={attachTriggerWrapper} className="relative">
      <ShortcutTooltip keys={["/model"]} label="Select model">
        <ModelSelectorTrigger
          ref={triggerRef}
          isOpen={selection.isOpen}
          disabled={isDisabled}
          minimal={minimal}
          mono={mono}
          loading={
            selection.isModelLoading
              ? {
                  message: selection.modelLoadingMessage,
                  progress: selection.modelLoadingProgress,
                  title: selection.selectedModelLabel,
                }
              : null
          }
          icon={
            selection.model === null ? (
              <span className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
                {createElement(SelectedTierIcon, { className: "h-4 w-4", "aria-hidden": true })}
                <span className="sr-only">{`${selection.selectedTierLabel} tier icon`}</span>
              </span>
            ) : undefined
          }
          modelName={selection.selectedModelInfo?.name || ""}
          modelProvider={selection.selectedModelInfo?.provider}
          label={selection.triggerLabel}
          title={selection.triggerTitle}
          onToggle={toggleSelector}
        />
      </ShortcutTooltip>

      {selection.isOpen && (
        <ModelSelectorPanel
          panelRef={dropdownRef}
          searchInputRef={searchInputRef}
          layout={panelLayout}
          onKeyDown={handleKeyDown}
          runtimeOptions={selection.runtimeOptions}
          selectedComputeSite={selection.computeSite}
          selectedMachineId={selection.selectedMachineId}
          onComputeSiteChange={selection.onComputeSiteChange}
          showTiers={selection.showTiers}
          searchQuery={selection.searchQuery}
          onSearchQueryChange={selection.setSearchQuery}
          capabilities={selection.capabilities}
          selectedCapability={selection.selectedCapability}
          onCapabilityChange={selection.setSelectedCapability}
          tierLineup={selection.tierLineup}
          modelTier={selection.modelTier}
          onModelTierChange={handleTierSelect}
          onTierShortcut={selection.selectTierById}
          models={selection.models}
          recentModels={selection.recentModels}
          modelLocations={selection.modelLocations}
          recentSyncError={selection.recentSyncError}
          featuredModelIds={selection.featuredModelIds}
          isDisabled={isDisabled}
          isModelLocked={selection.isModelLocked}
          isPro={selection.isPro}
          mono={mono}
          selectedModelId={selection.selectedModelId}
          onModelSelect={handleModelSelect}
          onInfoHoverStart={handleInfoHoverStart}
          onInfoHoverEnd={handleInfoHoverEnd}
        />
      )}
      <ModelHoverPreview
        preview={hoverPreview}
        containerRef={hoverPreviewRef}
        onMouseEnter={cancelHoverPreviewDismiss}
        onDismiss={handleInfoHoverEnd}
      />
    </div>
  );
}
