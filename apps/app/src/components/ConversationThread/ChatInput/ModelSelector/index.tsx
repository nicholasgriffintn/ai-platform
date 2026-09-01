import {
  getAutoRouterModeIcon,
  getHoverPreviewPosition,
  ModelHoverPreview,
  type ModelHoverPreviewState,
  ModelSelectorPanel,
  type ModelSelectorPanelLayout,
  type ModelSelectorTab,
  ModelSelectorTrigger,
  useHoverPreviewDismiss,
} from "@ngriffin_uk/polychat-component-models";
import { ShortcutTooltip } from "@ngriffin_uk/polychat-component-ui";
import { getDefaultLiveModelId } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getAutoRouterModeDefinition,
  getAvailableModels,
  getChatAndRealtimeModelsByMode,
  getFeaturedModelIds,
  getDefaultModelId,
  getModelByReference,
  getModelsByMode,
  getRealtimeSessionModelsByProvider,
  getToolCallModels,
  isActiveModel,
  isModelSelectableForAccount,
  isTextInputChatModel,
} from "@ngriffin_uk/polychat-schemas";
import type { ModelConfigItem, ModelModality } from "@ngriffin_uk/polychat-schemas";
import { containsEventTarget } from "@ngriffin_uk/polychat-utility-react";
import { Loader2 } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useRealtimeProviders } from "~/hooks/useRealtimeProviders";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { clearModelResponseSettings } from "~/lib/chat-settings";
import {
  useIsLoading,
  useLoadingMessage,
  useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type {
  ChatMode,
  ChatSettings,
  ModelSelectionChangeHandler,
  ModelSelectorScope,
} from "~/types";

import { useModelSelectorLayout } from "./useModelSelectorLayout";

interface ModelSelectorProps {
  isDisabled?: boolean;
  minimal?: boolean;
  mono?: boolean;
  featuredOnly?: boolean;
  modelProviderFilter?: string;
  modelScope?: ModelSelectorScope;
  onModelChange?: ModelSelectionChangeHandler;
}

export const ModelSelector = ({
  isDisabled,
  minimal = false,
  mono = false,
  featuredOnly = false,
  modelProviderFilter,
  modelScope = "default",
  onModelChange,
}: ModelSelectorProps) => {
  const { trackEvent, trackFeatureUsage } = useTrackEvent();
  const { isMobile } = useUIStore();
  const {
    isPro,
    model,
    setModel,
    autoMode,
    setAutoMode,
    chatMode,
    setChatMode,
    chatSettings,
    setChatSettings,
    selectedAgentId,
    setSelectedAgentId,
  } = useChatStore();
  const { agents } = useAgents();
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
      return "auto";
    }

    return "models";
  });

  const automaticModelOption: ModelConfigItem = {
    id: "auto",
    matchingModel: "auto",
    name: "Automatic",
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
  const selectedAutoMode = getAutoRouterModeDefinition(autoMode);
  const SelectedAutoModeIcon = getAutoRouterModeIcon(selectedAutoMode.id);
  const selectedAutoModeDisplayName =
    selectedAutoMode.id === "auto" ? selectedAutoMode.label : `${selectedAutoMode.label} auto`;
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
  const autoModeModels = useMemo(
    () =>
      Object.values(getModelsByMode(availableModels, "remote")).filter((modelConfig) =>
        isModelSelectableForAccount(modelConfig, isPro),
      ),
    [availableModels, isPro],
  );

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
      setSelectedAgentId(null);
    }

    if (selectedTab !== "models") {
      setSelectedTab("models");
    }

    const currentModel = model ? getModelByReference(filteredModelReferences, model) : undefined;

    if (
      currentModel &&
      isActiveModel(currentModel) &&
      (currentModel.isExecutable ?? isModelSelectableForAccount(currentModel, isPro))
    ) {
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
    setSelectedAgentId,
  ]);

  useEffect(() => {
    if (isModelListOnlyScope || chatMode !== "remote" || model === null) {
      return;
    }

    const currentModel = getModelByReference(filteredModelReferences, model);

    if (
      currentModel &&
      isActiveModel(currentModel) &&
      (currentModel.isExecutable ?? isModelSelectableForAccount(currentModel, isPro))
    ) {
      return;
    }

    selectModelWithDefaults(defaultModelId ?? null);
  }, [
    chatMode,
    defaultModelId,
    filteredModelReferences,
    isModelListOnlyScope,
    isPro,
    model,
    selectModelWithDefaults,
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
    triggerRef.current?.focus();
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
      searchInputRef.current.focus();

      return;
    }

    const firstOpt = dropdownRef.current?.querySelector("[data-model-option]");

    (firstOpt as HTMLElement | null)?.focus();
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
      setSelectedAgentId(null);
    }

    trackEvent({
      name: "set_model_source",
      category: "conversation",
      label: "model_source",
      value: newChatMode,
    });
  };

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const isModelLockedByAgent = Boolean(selectedAgent?.model);

  const currentAgentModel = selectedAgentId
    ? agents.find((agent) => agent.id === selectedAgentId)?.model
    : null;

  useEffect(() => {
    if (chatMode === "agent" && currentAgentModel !== undefined && currentAgentModel !== model) {
      selectModelWithDefaults(currentAgentModel);
    }
  }, [currentAgentModel, model, selectModelWithDefaults, chatMode]);

  if (isLoadingModels || (isLiveScope && isLoadingRealtimeProviders)) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  const handleModelChange = (newModel: string) => {
    selectModelWithDefaults(newModel);
    onModelChange?.(newModel, availableModels[newModel]);

    trackEvent({
      name: "set_model",
      category: "conversation",
      label: "select_model",
      value: newModel,
    });
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

  const handleSelectAutoMode = (nextAutoMode: typeof autoMode) => {
    setChatMode("remote");
    setSelectedAgentId(null);
    setAutoMode(nextAutoMode);
    selectModelWithDefaults(null, {
      ...chatSettings,
      localOnly: false,
    });
    onModelChange?.(null);
    closeSelector();

    trackEvent({
      name: "set_auto_mode",
      category: "conversation",
      label: "select_auto_mode",
      value: nextAutoMode,
    });
  };

  const handleTabChange = (tab: ModelSelectorTab) => {
    setSelectedTab(tab);
    if (tab === "auto") {
      setChatMode("remote");
      setSelectedAgentId(null);
      selectModelWithDefaults(null, {
        ...chatSettings,
        localOnly: false,
      });
      onModelChange?.(null);
    } else if (tab === "models" && model === null) {
      setChatMode("remote");
      setSelectedAgentId(null);
      selectModelWithDefaults(defaultModelId ?? null, {
        ...chatSettings,
        localOnly: false,
      });
    }
  };

  const agentModelLabel = selectedModelInfo?.name || "Model";
  const selectedModelLabel = selectedModelInfo?.name || "Select model";
  const isAgentLabel = Boolean(selectedAgent) && chatMode === "agent";
  const triggerLabel = isAgentLabel
    ? `${selectedAgent?.name} - ${agentModelLabel}`
    : model === null
      ? selectedAutoModeDisplayName
      : selectedModelLabel;
  const triggerTitle = isAgentLabel
    ? `${selectedAgent?.name} - ${agentModelLabel}`
    : isModelLockedByAgent
      ? `${agentModelLabel} (set by agent)`
      : model === null
        ? selectedAutoModeDisplayName
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
                aria-label={`${selectedAutoMode.label} automatic mode icon`}
              >
                <SelectedAutoModeIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : undefined
          }
          modelName={selectedModelInfo?.name || ""}
          modelProvider={selectedModelInfo?.provider}
          label={
            <>
              {triggerLabel}
              {isModelLockedByAgent && !selectedAgent && " (set by agent)"}
            </>
          }
          title={triggerTitle}
          onToggle={() => {
            const opening = !isOpen;

            if (opening) {
              if (isModelListOnlyScope) {
                setSelectedTab("models");
              } else if (model === null) {
                setSelectedTab("auto");
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
          showAutoTab={!isModelListOnlyScope}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          capabilities={capabilities}
          selectedCapability={selectedCapability}
          onCapabilityChange={setSelectedCapability}
          chatMode={isLiveScope ? undefined : chatMode}
          onChatModeChange={isLiveScope ? undefined : handleToggleModelSource}
          autoModeModels={autoModeModels}
          autoMode={autoMode}
          onAutoModeChange={handleSelectAutoMode}
          models={filteredModelList}
          featuredModelIds={featuredModelIds}
          isDisabled={isDisabled}
          isModelLocked={isModelLockedByAgent}
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
            handleModelChange(id);
            closeSelector();
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
