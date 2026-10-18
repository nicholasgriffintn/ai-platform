import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  buildConversationModeMetadata,
  useChatManager,
  useLiveConversationMessages,
  useRealtimeLiveSession,
  useRealtimeProviders,
} from "@ngriffin_uk/polychat-library-react";
import {
  getFirstReadyRealtimeLiveProviderOption,
  isComposedRealtimeLiveProvider,
  supportsRealtimeLiveVideoInput,
  waitsForRealtimeLiveProviderFinalEventOnStop,
} from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { MessageCircle, RadioTower } from "lucide-react";
import { useMemo, useState } from "react";

import { LiveSessionComposerControls } from "../Home/LiveChatModeControls.js";

export function useTeammateLiveMode(teammateName: string): Partial<ThreadModeConfig> {
  const isPro = useChatStore((state) => state.isPro);
  const { data: providerOptions = [] } = useRealtimeProviders(isPro);
  const composedOptions = useMemo(
    () =>
      providerOptions.filter((option) =>
        isComposedRealtimeLiveProvider(option.id, providerOptions),
      ),
    [providerOptions],
  );
  const provider = getFirstReadyRealtimeLiveProviderOption(composedOptions);
  const [active, setActive] = useState(false);
  const conversationMode = useMemo(() => buildConversationModeMetadata({ mode: "live" }), []);
  const { respondToExistingConversation } = useChatManager(undefined, conversationMode);
  const { flushLiveMessages, handleRealtimeEvent, handleTranscript } = useLiveConversationMessages({
    conversationMode,
    model: provider?.defaultModelId,
    onFinalInputTranscript: ({ assistantMessageData, conversationId }) =>
      void respondToExistingConversation(conversationId, { assistantMessageData }),
  });
  const session = useRealtimeLiveSession({
    model: provider?.defaultModelId,
    onEvent: handleRealtimeEvent,
    onTranscript: handleTranscript,
    providers: composedOptions,
  });

  if (!provider) {
    return {};
  }

  const stop = () => {
    if (!waitsForRealtimeLiveProviderFinalEventOnStop(provider.id, composedOptions)) {
      flushLiveMessages();
    }

    session.stop();
    setActive(false);
  };

  const modeControls: ThreadModeConfig["modeControls"] = {
    commands: [
      {
        id: "chat",
        label: "Chat",
        description: `Type to ${teammateName}.`,
        command: "chat",
        icon: <MessageCircle className="h-4 w-4" aria-hidden="true" />,
        isActive: !active,
        onSelect: () => {
          if (active) {
            stop();
          }
        },
      },
      {
        id: "live",
        label: "Live",
        description: `Talk to ${teammateName}. Each turn uses its tools and still asks before acting.`,
        command: "live",
        icon: <RadioTower className="h-4 w-4" aria-hidden="true" />,
        isActive: active,
        onSelect: () => {
          setActive(true);
          void session.start(provider.id, provider.defaultModelId);
        },
      },
    ],
    onClearActive: active ? stop : undefined,
  };

  if (!active) {
    return { modeControls };
  }

  return {
    modeControls,
    conversationMode,
    forceAutoPlayResponses: true,
    hideTextInput: true,
    hideSubmitButton: true,
    hideComposerActionMenu: true,
    inputControls: (
      <LiveSessionComposerControls
        cameraDevices={session.cameraDevices}
        error={session.error}
        inputAudioLevel={session.inputAudioLevel}
        lastEvent={session.lastEvent}
        lastTranscript={session.lastTranscript}
        microphoneEnabled={session.isMicrophoneEnabled}
        onCameraDeviceChange={session.setCameraDeviceId}
        onMicrophoneEnabledChange={session.setMicrophoneEnabled}
        onStart={() => void session.start(provider.id, provider.defaultModelId)}
        onStop={stop}
        onVideoEnabledChange={session.setVideoEnabled}
        outputAudioLevel={session.outputAudioLevel}
        selectedCameraDeviceId={session.selectedCameraDeviceId}
        status={session.status}
        videoEnabled={session.isVideoEnabled}
        videoPreviewStream={session.videoPreviewStream}
        videoSupported={supportsRealtimeLiveVideoInput(provider.id, composedOptions)}
      />
    ),
  };
}
