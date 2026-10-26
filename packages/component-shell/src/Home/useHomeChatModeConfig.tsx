import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useChat,
  useChatManager,
  useLiveConversationMessages,
  type FinalLiveInputTranscript,
  useModels,
  useRealtimeLiveSession,
  useRealtimeProviders,
  buildConversationModeMetadata,
  getConversationModeMetadata,
  getPlacePaths,
  HOME_CHAT_MODE_OPTIONS,
  getHomeChatModeAvailability,
  resolveHomeChatModeId,
} from "@ngriffin_uk/polychat-library-react";
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
  isRealtimeSessionModel,
} from "@ngriffin_uk/polychat-schemas";
import type { HomeChatModeId, ModelSelectionChangeHandler } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { LiveChatModeControls, LiveSessionComposerControls } from "./LiveChatModeControls.js";

export function useHomeChatModeConfig(): {
  activeModeId: HomeChatModeId;
  modeConfig: ThreadModeConfig;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentConversationId,
    homeChatMode,
    setHomeChatMode,
    setChatMode,
    setSelectedTeammateId,
    model: selectedModel,
    setModel,
    isPro,
    livePushToTalk,
    setLivePushToTalk,
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
  const modeParam = searchParams.has("mode") ? searchParams.get("mode") : homeChatMode;
  const [prevModeSyncKey, setPrevModeSyncKey] = useState(
    () =>
      `${currentConversationId ?? ""}:${conversationModeMetadata?.mode ?? ""}:${modeParam ?? ""}:${homeChatMode}`,
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
    pushToTalk: livePushToTalk,
  });
  const {
    error: liveError,
    cameraDevices: liveCameraDevices,
    inputAudioLevel: liveInputAudioLevel,
    isMicrophoneEnabled: liveMicrophoneEnabled,
    isTalking: liveTalking,
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
    startTalking: startLiveTalking,
    status: liveStatus,
    stop: stopLiveSession,
    stopTalking: stopLiveTalking,
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

  useEffect(() => {
    effectiveLiveProviderRef.current = effectiveLiveProvider ?? undefined;
  }, [effectiveLiveProvider]);
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

  const modeSyncKey = `${currentConversationId ?? ""}:${conversationModeMetadata?.mode ?? ""}:${modeParam ?? ""}:${homeChatMode}`;

  if (prevModeSyncKey !== modeSyncKey) {
    setPrevModeSyncKey(modeSyncKey);

    if (!(currentConversationId && conversationModeMetadata)) {
      setActiveModeId(resolveHomeChatModeId(modeParam));
    }
  }

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

    setSelectedTeammateId(null);
    setChatMode("chat");
  }, [activeModeId, setChatMode, setSelectedTeammateId]);

  const chatModelBeforeLiveRef = useRef<string | null>(null);
  const isLiveModelSelected = Boolean(
    selectedModelConfig && isRealtimeSessionModel(selectedModelConfig),
  );
  const rememberChatModel = useCallback(() => {
    if (!isLiveModelSelected) {
      chatModelBeforeLiveRef.current = selectedModel;
    }
  }, [isLiveModelSelected, selectedModel]);
  const restoreChatModel = useCallback(() => {
    if (isLiveModelSelected) {
      setModel(chatModelBeforeLiveRef.current);
    }
  }, [isLiveModelSelected, setModel]);

  const handleModeChange = useCallback(
    (modeId: HomeChatModeId) => {
      setActiveModeId(modeId);
      setHomeChatMode(modeId);
      const next = new URLSearchParams(searchParams);

      if (modeId === "chat") {
        next.delete("mode");
      } else {
        next.set("mode", modeId);
        setSelectedTeammateId(null);
        setChatMode("chat");
      }

      if (modeId === "live") {
        rememberChatModel();

        if (selectedModelLiveProvider) {
          setLiveProvider(selectedModelLiveProvider);
          void startLiveSession(selectedModelLiveProvider, selectedModel);
        } else {
          const currentProvider = getRealtimeLiveProviderOption(
            liveProvider ?? "",
            realtimeProviderOptions,
          );
          const nextProvider =
            currentProvider?.readiness === "ready"
              ? currentProvider
              : getFirstReadyRealtimeLiveProviderOption(realtimeProviderOptions);

          if (nextProvider && selectLiveProviderAndModel(nextProvider.id)) {
            void startLiveSession(nextProvider.id, nextProvider.defaultModelId);
          }
        }
      } else if (effectiveActiveModeId === "live") {
        stopLiveSessionAndFlush();
        restoreChatModel();
      }

      setSearchParams(next, { replace: true });
    },
    [
      effectiveActiveModeId,
      liveProvider,
      realtimeProviderOptions,
      rememberChatModel,
      restoreChatModel,
      selectLiveProviderAndModel,
      searchParams,
      selectedModel,
      selectedModelLiveProvider,
      setChatMode,
      setHomeChatMode,
      setLiveProvider,
      setSearchParams,
      setSelectedTeammateId,
      startLiveSession,
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
        rememberChatModel();
        setModel(modelId);
        setActiveModeId("live");
        setHomeChatMode("live");
        setSelectedTeammateId(null);
        setChatMode("chat");
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
      setChatMode("chat");
      next.delete("mode");
      setSearchParams(next, { replace: true });
    },
    [
      effectiveActiveModeId,
      modelReferences,
      realtimeProviderOptions,
      rememberChatModel,
      searchParams,
      setChatMode,
      setHomeChatMode,
      setLiveProvider,
      setModel,
      setSearchParams,
      setSelectedTeammateId,
      stopLiveSessionAndFlush,
    ],
  );

  return useMemo<{
    activeModeId: HomeChatModeId;
    modeConfig: ThreadModeConfig;
  }>(() => {
    const livePushToTalkControls = {
      enabled: livePushToTalk,
      talking: liveTalking,
      onEnabledChange: setLivePushToTalk,
      onTalkStart: startLiveTalking,
      onTalkEnd: stopLiveTalking,
    };
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
        pushToTalk={livePushToTalkControls}
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
        pushToTalk={livePushToTalkControls}
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
          assistantActionRoutes: { recipes: getPlacePaths("chat").scheduled },
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
          modelScope: "live",
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
        assistantActionRoutes: { recipes: getPlacePaths("chat").scheduled },
        modeControls,
        onModelChange: handleModelChange,
      },
    };
  }, [
    effectiveActiveModeId,
    handleModeChange,
    handleLiveProviderChange,
    handleModelChange,
    isPro,
    selectedModel,
    liveCameraDevices,
    liveError,
    liveInputAudioLevel,
    liveMicrophoneEnabled,
    livePushToTalk,
    liveTalking,
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
    setLivePushToTalk,
    setLiveVideoEnabled,
    startLiveSession,
    startLiveTalking,
    stopLiveSessionAndFlush,
    stopLiveTalking,
  ]);
}
