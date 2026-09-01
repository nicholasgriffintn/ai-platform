import {
  getComposedRealtimeReasoningModelId,
  getFirstReadyRealtimeLiveProviderOption,
  getRealtimeLiveProviderIdForModel,
  getRealtimeLiveProviderOption,
  isComposedRealtimeLiveProvider,
  supportsRealtimeLiveVideoInput,
  waitsForRealtimeLiveProviderFinalEventOnStop,
  type RealtimeLiveProviderId,
} from "@ngriffin_uk/polychat-library-realtime/live-providers";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getModelByReference,
} from "@ngriffin_uk/polychat-schemas";
import type { HomeChatModeId } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import {
  useLiveConversationMessages,
  type FinalLiveInputTranscript,
} from "~/hooks/useLiveConversationMessages";
import { useModels } from "~/hooks/useModels";
import { useRealtimeLiveSession } from "~/hooks/useRealtimeLiveSession";
import { useRealtimeProviders } from "~/hooks/useRealtimeProviders";
import {
  buildConversationModeMetadata,
  getConversationModeMetadata,
} from "~/lib/home-chat-modes/conversation-mode";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelSelectionChangeHandler } from "~/types";

import {
  HOME_CHAT_MODE_OPTIONS,
  getHomeChatModeAvailability,
  resolveHomeChatModeId,
} from "./chatModes";
import { LiveChatModeControls, LiveSessionComposerControls } from "./LiveChatModeControls";

export function useHomeChatModeConfig(): {
  activeModeId: HomeChatModeId;
  modeConfig: ConversationThreadModeConfig;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentConversationId,
    homeChatMode,
    setHomeChatMode,
    setChatMode,
    setSelectedAgentId,
    model: selectedModel,
    setModel,
    isPro,
  } = useChatStore();
  const { data: currentConversation } = useChat(currentConversationId);
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const { data: realtimeProviderOptions = [], isLoading: isLoadingRealtimeProviders } =
    useRealtimeProviders(isPro);
  const conversationModeMetadata = useMemo(
    () => getConversationModeMetadata(currentConversation),
    [currentConversation],
  );
  const modelReferences = useMemo(() => createModelReferenceMap(apiModels), [apiModels]);
  const selectedModelConfig = useMemo(
    () => getModelByReference(modelReferences, selectedModel),
    [modelReferences, selectedModel],
  );
  const composedReasoningModel = useMemo(
    () => getComposedRealtimeReasoningModelId(apiModels, selectedModel),
    [apiModels, selectedModel],
  );
  const selectedModelLiveProvider = getRealtimeLiveProviderIdForModel(
    selectedModelConfig,
    realtimeProviderOptions,
  );
  const [activeModeId, setActiveModeId] = useState<HomeChatModeId>(() =>
    resolveHomeChatModeId(searchParams.has("mode") ? searchParams.get("mode") : homeChatMode),
  );
  const effectiveActiveModeId = !isPro && activeModeId === "live" ? "chat" : activeModeId;
  const hydratedConversationIdRef = useRef<string | undefined>(undefined);
  const liveConversationMode = useMemo(
    () =>
      buildConversationModeMetadata({
        mode: "live",
      }),
    [],
  );
  const effectiveLiveProviderRef = useRef<RealtimeLiveProviderId | undefined>(undefined);
  const { respondToExistingConversation } = useChatManager(undefined, liveConversationMode);
  const handleFinalLiveInputTranscript = useCallback(
    ({ assistantMessageData, conversationId }: FinalLiveInputTranscript) => {
      const provider = effectiveLiveProviderRef.current;

      if (!provider || !isComposedRealtimeLiveProvider(provider, realtimeProviderOptions)) {
        return;
      }

      if (!composedReasoningModel) {
        return;
      }

      void respondToExistingConversation(conversationId, {
        assistantMessageData,
        model: composedReasoningModel,
      });
    },
    [composedReasoningModel, realtimeProviderOptions, respondToExistingConversation],
  );
  const {
    flushLiveMessages,
    handleRealtimeEvent: handleLiveRealtimeEvent,
    handleTranscript: handleLiveTranscript,
  } = useLiveConversationMessages({
    conversationMode: liveConversationMode,
    model: selectedModel,
    onFinalInputTranscript: handleFinalLiveInputTranscript,
  });
  const liveSession = useRealtimeLiveSession({
    model: selectedModel,
    onEvent: handleLiveRealtimeEvent,
    onTranscript: handleLiveTranscript,
    providers: realtimeProviderOptions,
  });
  const {
    error: liveError,
    cameraDevices: liveCameraDevices,
    inputAudioLevel: liveInputAudioLevel,
    isMicrophoneEnabled: liveMicrophoneEnabled,
    isVideoEnabled: liveVideoEnabled,
    lastEvent: liveLastEvent,
    lastTranscript: liveLastTranscript,
    outputAudioLevel: liveOutputAudioLevel,
    provider: liveProvider,
    selectedCameraDeviceId: liveSelectedCameraDeviceId,
    setCameraDeviceId: setLiveCameraDeviceId,
    setMicrophoneEnabled: setLiveMicrophoneEnabled,
    setProvider: setLiveProvider,
    setVideoEnabled: setLiveVideoEnabled,
    start: startLiveSession,
    status: liveStatus,
    stop: stopLiveSession,
    videoPreviewStream: liveVideoPreviewStream,
  } = liveSession;
  const stopLiveSessionAndFlush = useCallback(() => {
    if (
      waitsForRealtimeLiveProviderFinalEventOnStop(
        effectiveLiveProviderRef.current ?? liveProvider ?? "",
        realtimeProviderOptions,
      )
    ) {
      stopLiveSession();

      return;
    }

    flushLiveMessages();
    stopLiveSession();
  }, [flushLiveMessages, liveProvider, realtimeProviderOptions, stopLiveSession]);
  const effectiveLiveProvider = selectedModelLiveProvider ?? liveProvider;

  effectiveLiveProviderRef.current = effectiveLiveProvider ?? undefined;
  const forceLiveResponseAudio = isComposedRealtimeLiveProvider(
    effectiveLiveProvider ?? "",
    realtimeProviderOptions,
  );

  const selectLiveProviderAndModel = useCallback(
    (providerId: RealtimeLiveProviderId): boolean => {
      const option = getRealtimeLiveProviderOption(providerId, realtimeProviderOptions);

      if (option?.readiness !== "ready") {
        return false;
      }

      setLiveProvider(option.id);
      setModel(option.defaultModelId);

      return true;
    },
    [realtimeProviderOptions, setLiveProvider, setModel],
  );

  useEffect(() => {
    if (effectiveActiveModeId !== "live" || isLoadingRealtimeProviders) {
      return;
    }

    if (selectedModelLiveProvider) {
      if (selectedModelLiveProvider !== liveProvider) {
        setLiveProvider(selectedModelLiveProvider);
      }

      return;
    }

    const currentProvider = getRealtimeLiveProviderOption(
      liveProvider ?? "",
      realtimeProviderOptions,
    );

    if (currentProvider?.readiness === "ready") {
      if (selectedModel !== currentProvider.defaultModelId) {
        setModel(currentProvider.defaultModelId);
      }

      return;
    }

    const firstReadyProvider = getFirstReadyRealtimeLiveProviderOption(realtimeProviderOptions);

    if (firstReadyProvider) {
      selectLiveProviderAndModel(firstReadyProvider.id);
    }
  }, [
    effectiveActiveModeId,
    isLoadingRealtimeProviders,
    liveProvider,
    realtimeProviderOptions,
    selectLiveProviderAndModel,
    selectedModel,
    selectedModelLiveProvider,
    setLiveProvider,
    setModel,
  ]);

  useEffect(() => {
    if (currentConversationId && conversationModeMetadata) {
      return;
    }

    setActiveModeId(
      resolveHomeChatModeId(searchParams.has("mode") ? searchParams.get("mode") : homeChatMode),
    );
  }, [conversationModeMetadata, currentConversationId, homeChatMode, searchParams]);

  useEffect(() => {
    if (!currentConversationId) {
      hydratedConversationIdRef.current = undefined;

      return;
    }

    if (!conversationModeMetadata || hydratedConversationIdRef.current === currentConversationId) {
      return;
    }

    hydratedConversationIdRef.current = currentConversationId;
    setActiveModeId(resolveHomeChatModeId(conversationModeMetadata.mode));
  }, [conversationModeMetadata, currentConversationId]);

  useEffect(() => {
    if (activeModeId === "chat") {
      return;
    }

    setSelectedAgentId(null);
    setChatMode("remote");
  }, [activeModeId, setChatMode, setSelectedAgentId]);

  const handleModeChange = useCallback(
    (modeId: HomeChatModeId) => {
      setActiveModeId(modeId);
      setHomeChatMode(modeId);
      const next = new URLSearchParams(searchParams);

      if (modeId === "chat") {
        next.delete("mode");
      } else {
        next.set("mode", modeId);
        setSelectedAgentId(null);
        setChatMode("remote");
      }

      if (modeId === "live") {
        if (selectedModelLiveProvider) {
          setLiveProvider(selectedModelLiveProvider);
        } else {
          const currentProvider = getRealtimeLiveProviderOption(
            liveProvider ?? "",
            realtimeProviderOptions,
          );
          const nextProvider =
            currentProvider?.readiness === "ready"
              ? currentProvider
              : getFirstReadyRealtimeLiveProviderOption(realtimeProviderOptions);

          if (nextProvider) {
            selectLiveProviderAndModel(nextProvider.id);
          }
        }
      } else if (effectiveActiveModeId === "live") {
        stopLiveSessionAndFlush();
      }

      setSearchParams(next, { replace: true });
    },
    [
      effectiveActiveModeId,
      liveProvider,
      realtimeProviderOptions,
      selectLiveProviderAndModel,
      searchParams,
      selectedModelLiveProvider,
      setChatMode,
      setHomeChatMode,
      setLiveProvider,
      setSearchParams,
      setSelectedAgentId,
      stopLiveSessionAndFlush,
    ],
  );
  const handleLiveProviderChange = useCallback(
    (provider: RealtimeLiveProviderId) => {
      selectLiveProviderAndModel(provider);
    },
    [selectLiveProviderAndModel],
  );
  const handleModelChange = useCallback<ModelSelectionChangeHandler>(
    (modelId, modelConfig) => {
      const selectedConfig = modelConfig ?? getModelByReference(modelReferences, modelId);
      const nextLiveProvider = getRealtimeLiveProviderIdForModel(
        selectedConfig,
        realtimeProviderOptions,
      );
      const next = new URLSearchParams(searchParams);

      if (nextLiveProvider) {
        setModel(modelId);
        setActiveModeId("live");
        setHomeChatMode("live");
        setSelectedAgentId(null);
        setChatMode("remote");
        setLiveProvider(nextLiveProvider);
        next.set("mode", "live");
        setSearchParams(next, { replace: true });

        return;
      }

      if (effectiveActiveModeId !== "live") {
        return;
      }

      stopLiveSessionAndFlush();
      setActiveModeId("chat");
      setHomeChatMode("chat");
      setChatMode("remote");
      next.delete("mode");
      setSearchParams(next, { replace: true });
    },
    [
      effectiveActiveModeId,
      modelReferences,
      realtimeProviderOptions,
      searchParams,
      setChatMode,
      setHomeChatMode,
      setLiveProvider,
      setModel,
      setSearchParams,
      setSelectedAgentId,
      stopLiveSessionAndFlush,
    ],
  );

  return useMemo<{
    activeModeId: HomeChatModeId;
    modeConfig: ConversationThreadModeConfig;
  }>(() => {
    const liveControls = (
      <LiveChatModeControls
        cameraDevices={liveCameraDevices}
        error={liveError}
        lastEvent={liveLastEvent}
        lastTranscript={liveLastTranscript}
        microphoneEnabled={liveMicrophoneEnabled}
        onCameraDeviceChange={setLiveCameraDeviceId}
        onProviderChange={handleLiveProviderChange}
        onMicrophoneEnabledChange={setLiveMicrophoneEnabled}
        onStart={() => void startLiveSession(effectiveLiveProvider ?? undefined, selectedModel)}
        onStop={stopLiveSessionAndFlush}
        onVideoEnabledChange={setLiveVideoEnabled}
        options={realtimeProviderOptions}
        isLoadingProviders={isLoadingRealtimeProviders}
        provider={effectiveLiveProvider ?? ""}
        showHeader={effectiveActiveModeId !== "live"}
        showSessionControls={effectiveActiveModeId !== "live"}
        status={liveStatus}
        selectedCameraDeviceId={liveSelectedCameraDeviceId}
        videoEnabled={liveVideoEnabled}
        videoPreviewStream={liveVideoPreviewStream}
      />
    );
    const liveInputControls = (
      <LiveSessionComposerControls
        cameraDevices={liveCameraDevices}
        error={liveError}
        inputAudioLevel={liveInputAudioLevel}
        lastEvent={liveLastEvent}
        lastTranscript={liveLastTranscript}
        microphoneEnabled={liveMicrophoneEnabled}
        onCameraDeviceChange={setLiveCameraDeviceId}
        onMicrophoneEnabledChange={setLiveMicrophoneEnabled}
        onStart={() => void startLiveSession(effectiveLiveProvider ?? undefined, selectedModel)}
        onStop={stopLiveSessionAndFlush}
        onVideoEnabledChange={setLiveVideoEnabled}
        outputAudioLevel={liveOutputAudioLevel}
        selectedCameraDeviceId={liveSelectedCameraDeviceId}
        status={liveStatus}
        videoEnabled={liveVideoEnabled}
        videoPreviewStream={liveVideoPreviewStream}
        videoSupported={supportsRealtimeLiveVideoInput(
          effectiveLiveProvider ?? "",
          realtimeProviderOptions,
        )}
      />
    );
    const activeModeControls = effectiveActiveModeId === "live" ? liveControls : undefined;
    const modeControls = {
      activeModeControls,
      commands: HOME_CHAT_MODE_OPTIONS.filter(
        (option) => isPro || option.exclusiveGroup !== "chat-orchestration",
      ).map((option) => {
        const availability = getHomeChatModeAvailability(option, effectiveActiveModeId);
        const Icon = option.icon;

        return {
          id: option.id,
          label: option.label,
          description: option.description,
          command: option.id,
          icon: <Icon className="h-4 w-4" aria-hidden="true" />,
          isActive: effectiveActiveModeId === option.id,
          disabled: availability.disabled,
          disabledReason: availability.reason,
          keepPopoverOpen: option.id === "live",
          onSelect: () => handleModeChange(option.id),
        };
      }),
      onClearActive: effectiveActiveModeId === "chat" ? undefined : () => handleModeChange("chat"),
    };

    if (effectiveActiveModeId === "live") {
      return {
        activeModeId: effectiveActiveModeId,
        modeConfig: {
          assistantActionRoutes: { recipes: "/chat/capabilities" },
          analyticsSource: "live",
          welcomeTitle: "Start a live session",
          welcomeDescription:
            "Choose a live-capable model, then use voice or camera input in the active session.",
          welcomeSuggestions: [],
          inputPlaceholder: {
            newConversation: "Live mode is running. Transcripts can still be edited here...",
            followUp: "Live mode is running. Add notes or follow-up text...",
          },
          inputControls: liveInputControls,
          modelScope: "chat-and-live",
          onModelChange: handleModelChange,
          hideTextInput: true,
          hideComposerActionMenu: true,
          hideSubmitButton: true,
          hideInlineResponseControls: true,
          hideChatSettings: true,
          forceAutoPlayResponses: forceLiveResponseAudio,
          conversationMode: liveConversationMode,
          modeControls,
        },
      };
    }

    return {
      activeModeId: effectiveActiveModeId,
      modeConfig: {
        assistantActionRoutes: { recipes: "/chat/capabilities" },
        modeControls,
        onModelChange: handleModelChange,
      },
    };
  }, [
    effectiveActiveModeId,
    handleModeChange,
    handleLiveProviderChange,
    handleModelChange,
    selectedModel,
    liveCameraDevices,
    liveError,
    liveInputAudioLevel,
    liveMicrophoneEnabled,
    liveVideoEnabled,
    liveLastEvent,
    liveLastTranscript,
    liveOutputAudioLevel,
    liveSelectedCameraDeviceId,
    liveVideoPreviewStream,
    realtimeProviderOptions,
    isLoadingRealtimeProviders,
    effectiveLiveProvider,
    forceLiveResponseAudio,
    liveStatus,
    liveConversationMode,
    setLiveCameraDeviceId,
    setLiveMicrophoneEnabled,
    setLiveVideoEnabled,
    startLiveSession,
    stopLiveSessionAndFlush,
  ]);
}
