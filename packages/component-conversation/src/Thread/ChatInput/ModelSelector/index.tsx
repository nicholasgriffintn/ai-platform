import {
  getHoverPreviewPosition,
  getModelTierIcon,
  getModelTierLabel,
  ModelHoverPreview,
  type ModelHoverPreviewState,
  ModelSelectorPanel,
  type ModelSelectorPanelLayout,
  type ModelSelectorTab,
  ModelSelectorTrigger,
  type ModelTierSelection,
  useHoverPreviewDismiss,
} from "@ngriffin_uk/polychat-component-models";
import { ShortcutTooltip } from "@ngriffin_uk/polychat-component-ui";
import { clearModelResponseSettings } from "@ngriffin_uk/polychat-library-chat";
import type { ChatSettings } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useTrackEvent,
  useModels,
  useRealtimeProviders,
  useTeammates,
  useWebLLMModels,
  useIsLoading,
  useLoadingMessage,
  useLoadingProgress,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { getDefaultLiveModelId } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getAvailableModels,
  getChatAndRealtimeModelsByMode,
  getFeaturedModelIds,
  getDefaultModelId,
  getModelByReference,
  getModelsByMode,
  getRealtimeSessionModelsByProvider,
  getToolCallModels,
  isModelSelectableForAccount,
  isTextInputChatModel,
} from "@ngriffin_uk/polychat-schemas";
import type {
  ModelConfigItem,
  ModelModality,
  ChatMode,
  ModelSelectionChangeHandler,
  ModelSelectorScope,
} from "@ngriffin_uk/polychat-schemas";
import { containsEventTarget } from "@ngriffin_uk/polychat-utility-react";
import { Loader2 } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useModelSelectorLayout } from "./useModelSelectorLayout.js";

interface ModelSelectorProps {
  isDisabled?: boolean;
  minimal?: boolean;
  mono?: boolean;
  featuredOnly?: boolean;
  modelProviderFilter?: string;
  modelScope?: ModelSelectorScope;
  onModelChange?: ModelSelectionChangeHandler;
  onBeforeModelChange?: (modelId: string, model: ModelConfigItem) => boolean;
}

export const ModelSelector = ({
  isDisabled,
  minimal = false,
  mono = false,
  featuredOnly = false,
  modelProviderFilter,
  modelScope = "default",
  onModelChange,
  onBeforeModelChange,
}: ModelSelectorProps) => {
  const { trackEvent, trackFeatureUsage } = useTrackEvent();
  const { isMobile } = useUIStore();
  const {
    isAuthenticationLoading,
    isPro,
    model,
    setModel,
    modelTier,
    setModelTier,
    chatMode,
    setChatMode,
    chatSettings,
    setChatSettings,
    selectedTeammateId,
    setSelectedTeammateId,
  } = useChatStore();
  const { teammates } = useTeammates();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCapability, setSelectedCapability] = useState<ModelModality | null>(null);
  const [hoverPreview, setHoverPreview] = useState<ModelHoverPreviewState | null>(null);
  const isTextOnlyScope = modelScope === "text-only";
  const isLiveScope = modelScope === "live";
  const isChatAndLiveScope = modelScope === "chat-and-live";
  const isModelListOnlyScope = isTextOnlyScope || isLiveScope || isChatAndLiveScope;

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hoverPreviewRef = useRef<HTMLDivElement | null>(null);
  const [selectedTab, setSelectedTab] = useState<ModelSelectorTab>(() => {
    if (isModelListOnlyScope) {
      return "models";
    }

    if (model === null) {
      return "tiers";
    }

    return "models";
  });

  const automaticModelOption: ModelConfigItem = {
    id: "auto",
    matchingModel: "auto",
    name: getModelTierLabel(modelTier),
    provider: "System",
    modalities: { input: ["text"], output: ["text"] },
    strengths: [],
    isFree: true,
  };

  const { data: apiModels = EMPTY_MODEL_CONFIG, isLoading: isLoadingModels } = useModels();
  const { data: realtimeProviderOptions = [], isLoading: isLoadingRealtimeProviders } =
    useRealtimeProviders(isPro);
  const webLLMModels = useWebLLMModels({ enabled: chatMode === "local" });
  const isModelLoading = useIsLoading("model-init");
  const modelLoadingProgress = useLoadingProgress("model-init");
  const modelLoadingMessage = useLoadingMessage("model-init");

  const availableModels = useMemo(
    () => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
    [apiModels, chatMode, webLLMModels],
  );
  const functionModels = useMemo(() => getToolCallModels(availableModels), [availableModels]);
  const featuredModelIds = useMemo(() => getFeaturedModelIds(availableModels), [availableModels]);

  const modelListChatMode = isModelListOnlyScope && chatMode === "agent" ? "remote" : chatMode;
  const baseFilteredModels = useMemo(
    () =>
      isLiveScope
        ? getRealtimeSessionModelsByProvider(availableModels, modelProviderFilter)
        : isChatAndLiveScope
          ? getChatAndRealtimeModelsByMode(availableModels, modelListChatMode)
          : !isTextOnlyScope && chatMode === "agent"
            ? functionModels
            : getModelsByMode(availableModels, modelListChatMode),
    [
      availableModels,
      chatMode,
      functionModels,
      isChatAndLiveScope,
      isLiveScope,
      isTextOnlyScope,
      modelListChatMode,
      modelProviderFilter,
    ],
  );

  const filteredModels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(baseFilteredModels).filter(
          ([id, modelConfig]) =>
            (!featuredOnly || Boolean(featuredModelIds[id])) &&
            (!isTextOnlyScope || isTextInputChatModel(modelConfig)),
        ),
      ),
    [baseFilteredModels, featuredModelIds, featuredOnly, isTextOnlyScope],
  );

  const filteredModelReferences = useMemo(
    () => createModelReferenceMap(filteredModels),
    [filteredModels],
  );
  const defaultModelId = useMemo(() => getDefaultModelId(filteredModels), [filteredModels]);
  const SelectedTierIcon = getModelTierIcon(modelTier);
  const selectedTierDisplayName = `${getModelTierLabel(modelTier)} tier`;
  const selectedModelInfo =
    model === null ? automaticModelOption : getModelByReference(filteredModelReferences, model);

  const capabilities = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(filteredModels).flatMap((modelConfig) => modelConfig.strengths || []),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [filteredModels],
  );

  const filteredModelList = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return Object.values(filteredModels).filter((modelConfig) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        (modelConfig.name || modelConfig.matchingModel).toLowerCase().includes(normalizedQuery) ||
        (modelConfig.description || "").toLowerCase().includes(normalizedQuery) ||
        (modelConfig.provider || "").toLowerCase().includes(normalizedQuery);

      const matchesCapability =
        !selectedCapability || Boolean(modelConfig.strengths?.includes(selectedCapability));

      return matchesSearch && matchesCapability;
    });
  }, [filteredModels, searchQuery, selectedCapability]);
  const tierRuntime = chatMode === "local" ? "browser" : "hosted";
  const tierModels = useMemo(
    () =>
      Object.values(
        getModelsByMode(availableModels, chatMode === "local" ? "local" : "remote"),
      ).filter(
        (modelConfig) =>
          modelConfig.isExecutable ?? isModelSelectableForAccount(modelConfig, isPro),
      ),
    [availableModels, chatMode, isPro],
  );

  const isCatalogueUnverified =
    isLoadingModels || isAuthenticationLoading || filteredModelReferences.size === 0;

  const selectModelWithDefaults = useCallback(
    (nextModel: string | null, settings: ChatSettings = chatSettings) => {
      setModel(nextModel);
      setChatSettings(clearModelResponseSettings(settings));
    },
    [chatSettings, setChatSettings, setModel],
  );

  useEffect(() => {
    if (!isModelListOnlyScope) {
      return;
    }

    if (isLiveScope && isLoadingRealtimeProviders) {
      return;
    }

    if (chatMode === "agent") {
      setChatMode("remote");
      setSelectedTeammateId(null);
    }

    if (selectedTab !== "models") {
      setSelectedTab("models");
    }

    if (isCatalogueUnverified) {
      return;
    }

    if (model !== null) {
      return;
    }

    const defaultScopedModel =
      isLiveScope && modelProviderFilter
        ? getDefaultLiveModelId(modelProviderFilter, realtimeProviderOptions)
        : defaultModelId;
    const fallbackModel =
      defaultScopedModel && filteredModels[defaultScopedModel]
        ? defaultScopedModel
        : defaultModelId;

    if (fallbackModel) {
      selectModelWithDefaults(fallbackModel, {
        ...chatSettings,
        localOnly: modelListChatMode === "local",
      });
    }
  }, [
    chatMode,
    chatSettings,
    defaultModelId,
    filteredModels,
    filteredModelReferences,
    isCatalogueUnverified,
    isLiveScope,
    isLoadingRealtimeProviders,
    isModelListOnlyScope,
    isPro,
    model,
    modelProviderFilter,
    modelListChatMode,
    realtimeProviderOptions,
    selectModelWithDefaults,
    selectedTab,
    setChatMode,
    setSelectedTeammateId,
  ]);

  const clearHoverPreview = useCallback(() => setHoverPreview(null), []);
  const {
    cancelDismiss: cancelHoverPreviewDismiss,
    dismiss: dismissHoverPreview,
    scheduleDismiss: scheduleHoverPreviewDismiss,
  } = useHoverPreviewDismiss(clearHoverPreview, hoverPreviewRef);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isInsideSelector =
        containsEventTarget(dropdownRef.current, event.target) ||
        containsEventTarget(triggerWrapperRef.current, event.target) ||
        containsEventTarget(hoverPreviewRef.current, event.target);

      if (!isInsideSelector) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    dismissHoverPreview();
  }, [dismissHoverPreview, isOpen]);

  const closeSelector = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      closeSelector();

      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = dropdownRef.current?.querySelectorAll(
        '[data-model-option]:not([aria-disabled="true"])',
      );

      if (!items?.length) {
        return;
      }

      const list = Array.from(items) as HTMLElement[];
      const active = document.activeElement as HTMLElement;
      const idx = list.indexOf(active);
      let next = 0;

      if (e.key === "ArrowDown") {
        next = idx < list.length - 1 ? idx + 1 : 0;
      } else {
        next = idx > 0 ? idx - 1 : list.length - 1;
      }

      list[next].focus();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isMobile && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });

      return;
    }

    const firstOpt = dropdownRef.current?.querySelector("[data-model-option]");

    (firstOpt as HTMLElement | null)?.focus({ preventScroll: true });
  }, [isOpen, isMobile]);

  const panelLayout: ModelSelectorPanelLayout | null = useModelSelectorLayout(
    isOpen,
    triggerWrapperRef,
  );

  const handleToggleModelSource = (newChatMode: ChatMode) => {
    setChatMode(newChatMode);

    if (newChatMode === "local") {
      const nextSettings = {
        ...chatSettings,
        localOnly: true,
      };

      selectModelWithDefaults("", nextSettings);
    } else {
      const nextSettings = {
        ...chatSettings,
        localOnly: false,
      };

      selectModelWithDefaults(defaultModelId ?? null, nextSettings);
    }

    if (newChatMode !== "agent") {
      setSelectedTeammateId(null);
    }

    trackEvent({
      name: "set_model_source",
      category: "conversation",
      label: "model_source",
      value: newChatMode,
    });
  };

  const selectedTeammate = teammates.find((teammate) => teammate.id === selectedTeammateId);
  const isModelLockedByTeammate = Boolean(selectedTeammate?.model);

  const currentTeammateModel = selectedTeammateId
    ? teammates.find((teammate) => teammate.id === selectedTeammateId)?.model
    : null;

  useEffect(() => {
    if (
      chatMode === "agent" &&
      currentTeammateModel !== undefined &&
      currentTeammateModel !== model
    ) {
      selectModelWithDefaults(currentTeammateModel);
    }
  }, [currentTeammateModel, model, selectModelWithDefaults, chatMode]);

  if (isLoadingModels || (isLiveScope && isLoadingRealtimeProviders)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  const handleModelChange = (newModel: string) => {
    const nextModel = availableModels[newModel];

    if (!nextModel || onBeforeModelChange?.(newModel, nextModel) === false) {
      return false;
    }

    selectModelWithDefaults(newModel);
    onModelChange?.(newModel, nextModel);

    trackEvent({
      name: "set_model",
      category: "conversation",
      label: "select_model",
      value: newModel,
    });

    return true;
  };

  const handleInfoHoverStart = (modelInfo: ModelConfigItem, anchorRect: DOMRect) => {
    cancelHoverPreviewDismiss();

    if (!isOpen) {
      dismissHoverPreview();

      return;
    }

    const position = getHoverPreviewPosition(
      anchorRect,
      dropdownRef.current?.getBoundingClientRect(),
    );

    if (!position) {
      dismissHoverPreview();

      return;
    }

    setHoverPreview({
      model: modelInfo,
      ...position,
    });
  };

  const handleInfoHoverEnd = () => {
    scheduleHoverPreviewDismiss();
  };

  const handleSelectTier = ({ tier, agent }: ModelTierSelection) => {
    setModelTier(tier);
    setSelectedTeammateId(null);

    if (chatMode === "local" && agent) {
      selectModelWithDefaults(agent.id, { ...chatSettings, localOnly: true });
      onModelChange?.(agent.id, agent.config);
    } else {
      setChatMode("remote");
      selectModelWithDefaults(null, { ...chatSettings, localOnly: false });
      onModelChange?.(null);
    }

    closeSelector();

    trackEvent({
      name: "set_model_tier",
      category: "conversation",
      label: "select_model_tier",
      value: tier ?? "default",
    });
  };

  const handleTabChange = (tab: ModelSelectorTab) => {
    setSelectedTab(tab);
    if (tab === "tiers") {
      setChatMode("remote");
      setSelectedTeammateId(null);
      selectModelWithDefaults(null, {
        ...chatSettings,
        localOnly: false,
      });
      onModelChange?.(null);
    } else if (tab === "models" && model === null) {
      setChatMode("remote");
      setSelectedTeammateId(null);
      selectModelWithDefaults(defaultModelId ?? null, {
        ...chatSettings,
        localOnly: false,
      });
    }
  };

  const teammateModelLabel = selectedModelInfo?.name || "Model";
  const selectedModelLabel = selectedModelInfo?.name || "Select model";
  const isTeammateLabel = Boolean(selectedTeammate) && chatMode === "agent";
  const triggerLabel = isTeammateLabel
    ? `${selectedTeammate?.name} - ${teammateModelLabel}`
    : model === null
      ? selectedTierDisplayName
      : selectedModelLabel;
  const triggerTitle = isTeammateLabel
    ? `${selectedTeammate?.name} - ${teammateModelLabel}`
    : isModelLockedByTeammate
      ? `${teammateModelLabel} (set by teammate)`
      : model === null
        ? selectedTierDisplayName
        : selectedModelLabel;

  return (
    <div ref={triggerWrapperRef} className="relative">
      <ShortcutTooltip keys={["/model"]} label="Select model">
        <ModelSelectorTrigger
          ref={triggerRef}
          isOpen={isOpen}
          disabled={isDisabled}
          minimal={minimal}
          mono={mono}
          loading={
            isModelLoading
              ? {
                  message: modelLoadingMessage,
                  progress: modelLoadingProgress,
                  title: selectedModelLabel,
                }
              : null
          }
          icon={
            model === null ? (
              <span
                className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center"
                role="img"
                aria-label={`${getModelTierLabel(modelTier)} tier icon`}
              >
                <SelectedTierIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : undefined
          }
          modelName={selectedModelInfo?.name || ""}
          modelProvider={selectedModelInfo?.provider}
          label={
            <>
              {triggerLabel}
              {isModelLockedByTeammate && !selectedTeammate && " (set by teammate)"}
            </>
          }
          title={triggerTitle}
          onToggle={() => {
            const opening = !isOpen;

            if (opening) {
              if (isModelListOnlyScope) {
                setSelectedTab("models");
              } else if (model === null) {
                setSelectedTab("tiers");
              } else {
                setSelectedTab("models");
              }
            }

            setIsOpen(opening);
          }}
        />
      </ShortcutTooltip>

      {isOpen && (
        <ModelSelectorPanel
          panelRef={dropdownRef}
          searchInputRef={searchInputRef}
          layout={panelLayout}
          onKeyDown={handleKeyDown}
          selectedTab={selectedTab}
          onTabChange={handleTabChange}
          showTiersTab={!isModelListOnlyScope}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          capabilities={capabilities}
          selectedCapability={selectedCapability}
          onCapabilityChange={setSelectedCapability}
          chatMode={isLiveScope ? undefined : chatMode}
          onChatModeChange={isLiveScope ? undefined : handleToggleModelSource}
          tierModels={tierModels}
          tierRuntime={tierRuntime}
          modelTier={modelTier}
          onModelTierChange={handleSelectTier}
          models={filteredModelList}
          featuredModelIds={featuredModelIds}
          isDisabled={isDisabled}
          isModelLocked={isModelLockedByTeammate}
          isPro={isPro}
          mono={mono}
          selectedModelId={selectedModelInfo?.id}
          onModelSelect={(id, modelInfo) => {
            trackFeatureUsage("model_selected", {
              model_id: id,
              previous_model_id: selectedModelInfo?.id || "none",
              model_provider: modelInfo.provider,
              is_free_model: String(modelInfo.isFree),
            });
            if (handleModelChange(id)) {
              closeSelector();
            }
          }}
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
};
