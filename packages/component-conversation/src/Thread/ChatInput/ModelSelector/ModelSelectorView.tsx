import {
  getModelTierIcon,
  ModelHoverPreview,
  ModelSelectorPanel,
  ModelSelectorTrigger,
} from "@ngriffin_uk/polychat-component-models";
import { ShortcutTooltip } from "@ngriffin_uk/polychat-component-ui";
import type { ModelSelectionState, ModelTierSelection } from "@ngriffin_uk/polychat-library-react";

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
  const SelectedTierIcon = getModelTierIcon(selection.modelTier);

  const handleModelSelect = (id: string) => {
    if (selection.selectModel(id)) {
      controller.closeSelector();
    }
  };

  const handleTierSelect = (tierSelection: ModelTierSelection) => {
    selection.selectTier(tierSelection);
    controller.closeSelector();
  };

  return (
    <div ref={controller.triggerWrapperRef} className="relative">
      <ShortcutTooltip keys={["/model"]} label="Select model">
        <ModelSelectorTrigger
          ref={controller.triggerRef}
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
              <span
                className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center"
                role="img"
                aria-label={`${selection.selectedTierLabel} tier icon`}
              >
                <SelectedTierIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : undefined
          }
          modelName={selection.selectedModelInfo?.name || ""}
          modelProvider={selection.selectedModelInfo?.provider}
          label={selection.triggerLabel}
          title={selection.triggerTitle}
          onToggle={controller.toggleSelector}
        />
      </ShortcutTooltip>

      {selection.isOpen && (
        <ModelSelectorPanel
          panelRef={controller.dropdownRef}
          searchInputRef={controller.searchInputRef}
          layout={controller.panelLayout}
          onKeyDown={controller.handleKeyDown}
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
          featuredModelIds={selection.featuredModelIds}
          isDisabled={isDisabled}
          isModelLocked={selection.isModelLocked}
          isPro={selection.isPro}
          mono={mono}
          selectedModelId={selection.selectedModelId}
          onModelSelect={handleModelSelect}
          onInfoHoverStart={controller.handleInfoHoverStart}
          onInfoHoverEnd={controller.handleInfoHoverEnd}
        />
      )}
      <ModelHoverPreview
        preview={controller.hoverPreview}
        containerRef={controller.hoverPreviewRef}
        onMouseEnter={controller.cancelHoverPreviewDismiss}
        onDismiss={controller.handleInfoHoverEnd}
      />
    </div>
  );
}
