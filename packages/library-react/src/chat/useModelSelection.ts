import { clearModelResponseSettings } from "@ngriffin_uk/polychat-library-chat";
import type { ChatSettings } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { getDefaultLiveModelId } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getAvailableModels,
  getChatAndRealtimeModelsByMode,
  getDefaultModelId,
  getFeaturedModelIds,
  getModelByReference,
  getModelsByMode,
  getModelTierDefinition,
  getLineupModelsByRuntime,
  getRealtimeSessionModelsByProvider,
  getToolCallModels,
  isTextInputChatModel,
  type ComputeSite,
  type ModelCatalogItem,
  type ModelConfig,
  type ModelConfigItem,
  type ModelModality,
  type ModelSelectionChangeHandler,
  type ModelSelectorScope,
  type ModelTier,
  type ModelTierLineup,
  type ResolvedModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTrackEvent } from "../hooks/use-track-event.js";
import { useRealtimeProviders } from "../hooks/useRealtimeProviders.js";
import { useTeammates } from "../hooks/useTeammates.js";
import {
  getModelSelectorShortcut,
  MODEL_SELECTOR_SHORTCUT_EVENT,
} from "../lib/keyboard-shortcuts.js";
import { resolveModelTierLineup } from "../lib/model-lineup-view.js";
import { useIsLoading, useLoadingMessage, useLoadingProgress } from "../state/LoadingContext.js";
import { DEVICE_MODELS_QUERY_KEY } from "./useDeviceModels.js";
import { useModelRuntimeOptions, type ModelRuntimeOption } from "./useModelRuntimeOptions.js";
import { useModels } from "./useModels.js";
import { useWebLLMModels } from "./useWebLLMModels.js";

export interface ModelTierSelection {
  tier: ModelTier | null;
  agent: ResolvedModelTier | null;
}

export interface ModelSelectionOptions {
  featuredOnly?: boolean;
  modelProviderFilter?: string;
  modelScope?: ModelSelectorScope;
  onModelChange?: ModelSelectionChangeHandler;
  onBeforeModelChange?: (modelId: string, model: ModelConfigItem) => boolean;
}

export interface ModelSelectionState {
  isOpen: boolean;
  openSelector: () => void;
  closeSelector: () => void;
  toggleSelector: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  capabilities: ModelModality[];
  selectedCapability: ModelModality | null;
  setSelectedCapability: (capability: ModelModality | null) => void;
  showTiers: boolean;
  runtimeOptions: ModelRuntimeOption[];
  selectedMachineId?: string;
  computeSite: ComputeSite;
  onComputeSiteChange: (computeSite: ComputeSite, machineId?: string) => void;
  tierLineup: ModelTierLineup;
  modelTier: ModelTier | null;
  selectTierById: (tier: ModelTier) => void;
  isLoading: boolean;
  isModelLoading: boolean;
  modelLoadingMessage?: string;
  modelLoadingProgress?: number;
  model: string | null;
  selectedTierLabel: string;
  selectedModelInfo?: ModelConfigItem;
  selectedModelId?: string;
  selectedModelLabel: string;
  triggerLabel: string;
  triggerTitle: string;
  featuredModelIds: Record<string, ModelCatalogItem>;
  models: ModelCatalogItem[];
  isPro: boolean;
  isModelLocked: boolean;
  selectModel: (modelId: string) => boolean;
  selectTier: (selection: ModelTierSelection) => void;
}

export function useModelSelection({
  featuredOnly = false,
  modelProviderFilter,
  modelScope = "default",
  onModelChange,
  onBeforeModelChange,
}: ModelSelectionOptions = {}): ModelSelectionState {
  const queryClient = useQueryClient();
  const { trackEvent, trackFeatureUsage } = useTrackEvent();
  const {
    isPro,
    isAuthenticationLoading,
    model,
    setModel,
    modelTier,
    setModelTier,
    chatMode,
    setChatMode,
    computeSite,
    setComputeSite,
    chatSettings,
    setChatSettings,
    selectedTeammateId,
    setSelectedTeammateId,
  } = useChatStore();
  const { teammates } = useTeammates();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCapability, setSelectedCapability] = useState<ModelModality | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | undefined>();
  const isTextOnlyScope = modelScope === "text-only";
  const isLiveScope = modelScope === "live";
  const isChatAndLiveScope = modelScope === "chat-and-live";
  const isModelListOnlyScope = isTextOnlyScope || isLiveScope || isChatAndLiveScope;
  const selectedTierLabel = modelTier ? getModelTierDefinition(modelTier).label : "Default";
  const { data: apiModels = EMPTY_MODEL_CONFIG, isLoading: isLoadingModels } = useModels();
  const { data: realtimeProviderOptions = [], isLoading: isLoadingRealtimeProviders } =
    useRealtimeProviders(isPro);
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });
  const isModelLoading = useIsLoading("model-init");
  const modelLoadingProgress = useLoadingProgress("model-init");
  const modelLoadingMessage = useLoadingMessage("model-init");
  const availableModels = useMemo(
    () => getAvailableModels(apiModels, true, webLLMModels),
    [apiModels, webLLMModels],
  );
  const runtimeOptionsState = useModelRuntimeOptions(availableModels);
  const siteModels = useMemo(
    () => getLineupModelsByRuntime(availableModels, computeSite, selectedMachineId),
    [availableModels, computeSite, selectedMachineId],
  );
  const functionModels = useMemo(() => getToolCallModels(siteModels), [siteModels]);
  const featuredModelIds = useMemo(() => getFeaturedModelIds(siteModels), [siteModels]);
  const baseFilteredModels = useMemo(
    () =>
      isLiveScope
        ? getRealtimeSessionModelsByProvider(siteModels, modelProviderFilter)
        : isChatAndLiveScope
          ? getChatAndRealtimeModelsByMode(siteModels, computeSite)
          : !isTextOnlyScope && chatMode === "agent"
            ? functionModels
            : getModelsByMode(siteModels, computeSite),
    [
      chatMode,
      computeSite,
      functionModels,
      isChatAndLiveScope,
      isLiveScope,
      isTextOnlyScope,
      modelProviderFilter,
      siteModels,
    ],
  );
  const filteredModels = useMemo<ModelConfig>(
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
  const availableModelReferences = useMemo(
    () => createModelReferenceMap(availableModels),
    [availableModels],
  );
  const defaultModelId = useMemo(() => getDefaultModelId(filteredModels), [filteredModels]);
  const automaticModelOption: ModelConfigItem = useMemo(
    () => ({
      id: "auto",
      matchingModel: "auto",
      name: selectedTierLabel,
      provider: "System",
      modalities: { input: ["text"], output: ["text"] },
      strengths: [],
      isFree: true,
    }),
    [selectedTierLabel],
  );
  const selectedModelInfo =
    model === null ? automaticModelOption : getModelByReference(availableModelReferences, model);
  const capabilities = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(filteredModels).flatMap((modelConfig) => modelConfig.strengths || []),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [filteredModels],
  );
  const models = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return Object.entries(filteredModels).reduce<ModelCatalogItem[]>(
      (matchingModels, [id, modelConfig]) => {
        const matchesSearch =
          normalizedQuery.length === 0 ||
          (modelConfig.name || modelConfig.matchingModel).toLowerCase().includes(normalizedQuery) ||
          (modelConfig.description || "").toLowerCase().includes(normalizedQuery) ||
          (modelConfig.provider || "").toLowerCase().includes(normalizedQuery);
        const matchesCapability =
          !selectedCapability || Boolean(modelConfig.strengths?.includes(selectedCapability));

        if (matchesSearch && matchesCapability) {
          matchingModels.push({ ...modelConfig, id });
        }

        return matchingModels;
      },
      [],
    );
  }, [filteredModels, searchQuery, selectedCapability]);
  const tierLineup = useMemo(
    () => resolveModelTierLineup(siteModels, computeSite, selectedMachineId),
    [computeSite, selectedMachineId, siteModels],
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

    if (computeSite !== "hosted") {
      setComputeSite("hosted");
      setSelectedMachineId(undefined);

      return;
    }

    if (isCatalogueUnverified || model !== null) {
      return;
    }

    const scopedDefaultModel =
      isLiveScope && modelProviderFilter
        ? getDefaultLiveModelId(modelProviderFilter, realtimeProviderOptions)
        : defaultModelId;
    const fallbackModel =
      scopedDefaultModel && filteredModels[scopedDefaultModel]
        ? scopedDefaultModel
        : defaultModelId;

    if (fallbackModel) {
      selectModelWithDefaults(fallbackModel);
    }
  }, [
    computeSite,
    defaultModelId,
    filteredModels,
    isCatalogueUnverified,
    isLiveScope,
    isLoadingRealtimeProviders,
    isModelListOnlyScope,
    model,
    modelProviderFilter,
    realtimeProviderOptions,
    selectModelWithDefaults,
    setComputeSite,
  ]);

  const openSelector = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [DEVICE_MODELS_QUERY_KEY] });
    void runtimeOptionsState.refresh();
    setIsOpen(true);
  }, [queryClient, runtimeOptionsState]);
  const closeSelector = useCallback(() => setIsOpen(false), []);
  const toggleSelector = useCallback(() => {
    if (isOpen) {
      closeSelector();
    } else {
      openSelector();
    }
  }, [closeSelector, isOpen, openSelector]);
  const handleComputeSiteChange = useCallback(
    (nextComputeSite: ComputeSite, machineId?: string) => {
      if (computeSite === nextComputeSite && selectedMachineId === machineId) {
        void runtimeOptionsState.refresh();

        return;
      }

      const nextAvailableModels = getAvailableModels(apiModels, true, webLLMModels);
      const nextSiteModels = getLineupModelsByRuntime(
        nextAvailableModels,
        nextComputeSite,
        machineId,
      );
      const nextModel = getDefaultModelId(nextSiteModels) ?? Object.keys(nextSiteModels)[0] ?? null;

      setComputeSite(nextComputeSite);
      setSelectedMachineId(nextComputeSite === "machine" ? machineId : undefined);
      setSelectedTeammateId(null);
      selectModelWithDefaults(nextModel);

      trackEvent({
        name: "set_model_source",
        category: "conversation",
        label: "model_source",
        value: nextComputeSite,
      });
    },
    [
      apiModels,
      computeSite,
      runtimeOptionsState,
      selectedMachineId,
      selectModelWithDefaults,
      setComputeSite,
      setSelectedTeammateId,
      trackEvent,
      webLLMModels,
    ],
  );
  const selectModel = useCallback(
    (newModel: string) => {
      const nextModel = availableModels[newModel];

      if (!nextModel) {
        return false;
      }

      trackFeatureUsage("model_selected", {
        model_id: newModel,
        previous_model_id: selectedModelInfo?.id || "none",
        model_provider: nextModel.provider,
        is_free_model: String(nextModel.isFree),
      });

      if (onBeforeModelChange?.(newModel, nextModel) === false) {
        return false;
      }

      const nextComputeSite: ComputeSite = nextModel.machineId
        ? "machine"
        : nextModel.provider === "web-llm"
          ? "browser"
          : nextModel.runsOn === "device"
            ? "device"
            : "hosted";

      setComputeSite(nextComputeSite);
      setSelectedMachineId(nextModel.machineId);
      selectModelWithDefaults(newModel);
      onModelChange?.(newModel, nextModel);
      trackEvent({
        name: "set_model",
        category: "conversation",
        label: "select_model",
        value: newModel,
      });

      return true;
    },
    [
      availableModels,
      onBeforeModelChange,
      onModelChange,
      selectModelWithDefaults,
      selectedModelInfo?.id,
      setComputeSite,
      trackEvent,
      trackFeatureUsage,
    ],
  );
  const selectTier = useCallback(
    ({ tier, agent }: ModelTierSelection) => {
      setModelTier(tier);
      setChatMode("chat");
      setSelectedTeammateId(null);

      if (computeSite !== "hosted" && agent) {
        const agentModel = availableModels[agent.id];

        selectModelWithDefaults(agent.id);
        onModelChange?.(agent.id, agentModel);
      } else {
        selectModelWithDefaults(null);
        onModelChange?.(null);
      }

      trackEvent({
        name: "set_model_tier",
        category: "conversation",
        label: "select_model_tier",
        value: tier ?? "default",
      });
    },
    [
      availableModels,
      computeSite,
      onModelChange,
      selectModelWithDefaults,
      setChatMode,
      setModelTier,
      setSelectedTeammateId,
      trackEvent,
    ],
  );
  const selectTierById = useCallback(
    (tier: ModelTier) => {
      const agent = tierLineup[tier].agent;

      if (agent) {
        selectTier({ tier, agent });
      }
    },
    [selectTier, tierLineup],
  );
  const selectedTeammate = teammates.find((teammate) => teammate.id === selectedTeammateId);
  const currentTeammateModel = selectedTeammateId ? selectedTeammate?.model : null;
  const isModelLocked = Boolean(selectedTeammate?.model);

  useEffect(() => {
    if (
      chatMode === "agent" &&
      currentTeammateModel !== undefined &&
      currentTeammateModel !== model
    ) {
      selectModelWithDefaults(currentTeammateModel);
    }
  }, [chatMode, currentTeammateModel, model, selectModelWithDefaults]);

  useEffect(() => {
    const handleShortcut = (event: Event) => {
      const shortcut = getModelSelectorShortcut(event);

      if (!shortcut) {
        return;
      }

      if (shortcut === "open") {
        openSelector();

        return;
      }

      if (!isOpen) {
        return;
      }

      const currentRuntimeIndex = runtimeOptionsState.options.findIndex(
        (option) =>
          option.site === computeSite &&
          (option.site !== "machine" || option.machineId === selectedMachineId),
      );

      if (shortcut === "cycle-compute-site" && runtimeOptionsState.options.length > 0) {
        const nextRuntime =
          runtimeOptionsState.options[
            (currentRuntimeIndex + 1 + runtimeOptionsState.options.length) %
              runtimeOptionsState.options.length
          ];

        handleComputeSiteChange(nextRuntime.site, nextRuntime.machineId);
      }
    };

    window.addEventListener(MODEL_SELECTOR_SHORTCUT_EVENT, handleShortcut);

    return () => window.removeEventListener(MODEL_SELECTOR_SHORTCUT_EVENT, handleShortcut);
  }, [
    computeSite,
    handleComputeSiteChange,
    isOpen,
    openSelector,
    runtimeOptionsState.options,
    selectedMachineId,
  ]);

  const teammateModelLabel = selectedModelInfo?.name || "Model";
  const selectedModelLabel = selectedModelInfo?.name || "Select model";
  const isTeammateLabel = Boolean(selectedTeammate) && chatMode === "agent";
  const triggerLabel = isTeammateLabel
    ? `${selectedTeammate?.name} - ${teammateModelLabel}`
    : model === null
      ? `${selectedTierLabel} tier`
      : selectedModelLabel;
  const triggerTitle = isTeammateLabel
    ? `${selectedTeammate?.name} - ${teammateModelLabel}`
    : isModelLocked
      ? `${teammateModelLabel} (set by teammate)`
      : model === null
        ? `${selectedTierLabel} tier`
        : selectedModelLabel;

  return {
    isOpen,
    openSelector,
    closeSelector,
    toggleSelector,
    searchQuery,
    setSearchQuery,
    capabilities,
    selectedCapability,
    setSelectedCapability,
    showTiers: !isModelListOnlyScope,
    runtimeOptions: runtimeOptionsState.options,
    selectedMachineId,
    computeSite,
    onComputeSiteChange: handleComputeSiteChange,
    tierLineup,
    modelTier,
    selectTierById,
    isLoading: isLoadingModels || (isLiveScope && isLoadingRealtimeProviders),
    isModelLoading,
    modelLoadingMessage,
    modelLoadingProgress,
    model,
    selectedTierLabel,
    selectedModelInfo,
    selectedModelId: model ?? undefined,
    selectedModelLabel,
    triggerLabel:
      isModelLocked && !isTeammateLabel ? `${triggerLabel} (set by teammate)` : triggerLabel,
    triggerTitle,
    featuredModelIds,
    models,
    isPro,
    isModelLocked,
    selectModel,
    selectTier,
  };
}
