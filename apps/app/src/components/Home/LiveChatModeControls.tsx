import {
  LiveCameraDialog,
  LiveComposerTransport,
  LiveMediaControls,
  LiveProviderPicker,
  LiveSessionButton,
  LiveSessionDetail,
  LiveStatusHeader,
  getStatusCopy,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  REALTIME_LIVE_PROVIDER_OPTIONS,
  type RealtimeLiveProviderId,
  supportsRealtimeLiveVideoInput,
} from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { useState } from "react";

import type { RealtimeCameraDevice, RealtimeLiveStatus } from "~/hooks/useRealtimeLiveSession";

interface LiveChatModeControlsProps {
  error?: string | null;
  lastEvent: string;
  lastTranscript?: string | null;
  microphoneEnabled: boolean;
  cameraDevices: RealtimeCameraDevice[];
  onProviderChange: (provider: RealtimeLiveProviderId) => void;
  onCameraDeviceChange: (deviceId: string) => void;
  onMicrophoneEnabledChange: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onVideoEnabledChange: (enabled: boolean) => void;
  provider: RealtimeLiveProviderId;
  showHeader?: boolean;
  showSessionControls?: boolean;
  status: RealtimeLiveStatus;
  selectedCameraDeviceId: string;
  videoEnabled: boolean;
  videoPreviewStream?: MediaStream | null;
}

interface LiveSessionControlsProps {
  cameraDevices: RealtimeCameraDevice[];
  error?: string | null;
  inputAudioLevel?: number;
  lastEvent: string;
  lastTranscript?: string | null;
  microphoneEnabled: boolean;
  onCameraDeviceChange: (deviceId: string) => void;
  onMicrophoneEnabledChange: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onVideoEnabledChange: (enabled: boolean) => void;
  outputAudioLevel?: number;
  status: RealtimeLiveStatus;
  selectedCameraDeviceId: string;
  variant?: "panel" | "composer";
  videoEnabled: boolean;
  videoPreviewStream?: MediaStream | null;
  videoSupported: boolean;
}

function LiveSessionControls({
  cameraDevices,
  error,
  inputAudioLevel,
  lastEvent,
  lastTranscript,
  microphoneEnabled,
  onCameraDeviceChange,
  onMicrophoneEnabledChange,
  onStart,
  onStop,
  onVideoEnabledChange,
  outputAudioLevel,
  selectedCameraDeviceId,
  status,
  variant = "panel",
  videoEnabled,
  videoPreviewStream,
  videoSupported,
}: LiveSessionControlsProps) {
  const detail = error ?? lastTranscript ?? lastEvent;
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);

  const handleVideoButtonClick = () => {
    if (videoEnabled) {
      onVideoEnabledChange(false);
      setCameraDialogOpen(false);
      return;
    }

    onVideoEnabledChange(true);
    setCameraDialogOpen(true);
  };

  if (variant === "composer") {
    return (
      <>
        <LiveComposerTransport
          inputAudioLevel={inputAudioLevel}
          microphoneEnabled={microphoneEnabled}
          onMicrophoneEnabledChange={onMicrophoneEnabledChange}
          onStart={onStart}
          onStop={onStop}
          onVideoButtonClick={handleVideoButtonClick}
          outputAudioLevel={outputAudioLevel}
          status={status}
          videoEnabled={videoEnabled}
          videoSupported={videoSupported}
        />
        <LiveCameraDialog
          cameraDevices={cameraDevices}
          onCameraDeviceChange={onCameraDeviceChange}
          onOpenChange={setCameraDialogOpen}
          open={cameraDialogOpen}
          selectedCameraDeviceId={selectedCameraDeviceId}
          videoPreviewStream={videoPreviewStream}
        />
      </>
    );
  }

  return (
    <div className="space-y-2">
      <LiveSessionDetail detail={detail} />
      <div className="flex shrink-0 items-center gap-2">
        <LiveMediaControls
          microphoneEnabled={microphoneEnabled}
          onMicrophoneEnabledChange={onMicrophoneEnabledChange}
          onVideoButtonClick={handleVideoButtonClick}
          videoEnabled={videoEnabled}
          videoSupported={videoSupported}
        />
        <LiveSessionButton status={status} onStart={onStart} onStop={onStop} fill />
      </div>
      <LiveCameraDialog
        cameraDevices={cameraDevices}
        onCameraDeviceChange={onCameraDeviceChange}
        onOpenChange={setCameraDialogOpen}
        open={cameraDialogOpen}
        selectedCameraDeviceId={selectedCameraDeviceId}
        videoPreviewStream={videoPreviewStream}
      />
    </div>
  );
}

export function LiveSessionComposerControls(props: Omit<LiveSessionControlsProps, "variant">) {
  return <LiveSessionControls {...props} variant="composer" />;
}

export function LiveChatModeControls({
  cameraDevices,
  error,
  lastEvent,
  lastTranscript,
  microphoneEnabled,
  onCameraDeviceChange,
  onProviderChange,
  onMicrophoneEnabledChange,
  onStart,
  onStop,
  onVideoEnabledChange,
  provider,
  showHeader = true,
  showSessionControls = true,
  status,
  selectedCameraDeviceId,
  videoEnabled,
  videoPreviewStream,
}: LiveChatModeControlsProps) {
  const statusCopy = getStatusCopy(status);
  const isActive = status === "active";
  const isConnecting = status === "connecting";

  return (
    <div className="space-y-2">
      {showHeader && <LiveStatusHeader status={status} statusCopy={statusCopy} />}
      <LiveProviderPicker
        options={REALTIME_LIVE_PROVIDER_OPTIONS}
        provider={provider}
        onProviderChange={(providerId) => onProviderChange(providerId as RealtimeLiveProviderId)}
        isLocked={isActive || isConnecting}
      />
      {showSessionControls && (
        <LiveSessionControls
          cameraDevices={cameraDevices}
          error={error}
          lastEvent={lastEvent}
          lastTranscript={lastTranscript}
          microphoneEnabled={microphoneEnabled}
          onCameraDeviceChange={onCameraDeviceChange}
          onMicrophoneEnabledChange={onMicrophoneEnabledChange}
          onStart={onStart}
          onStop={onStop}
          onVideoEnabledChange={onVideoEnabledChange}
          selectedCameraDeviceId={selectedCameraDeviceId}
          status={status}
          videoEnabled={videoEnabled}
          videoPreviewStream={videoPreviewStream}
          videoSupported={supportsRealtimeLiveVideoInput(provider)}
        />
      )}
    </div>
  );
}
