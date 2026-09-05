import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { RealtimeLiveStatus } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { AudioLines, Loader2, Mic, MicOff, Pause, Video, VideoOff } from "lucide-react";

import { LiveAudioLevelMeter } from "./LiveMediaControls";

export interface LiveComposerTransportProps {
  inputAudioLevel?: number;
  microphoneEnabled: boolean;
  onMicrophoneEnabledChange: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onVideoButtonClick: () => void;
  outputAudioLevel?: number;
  status: RealtimeLiveStatus;
  videoEnabled: boolean;
  videoSupported: boolean;
}

export function getStatusCopy(status: RealtimeLiveStatus): string {
  switch (status) {
    case "active":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "error":
      return "Error";
    default:
      return "Ready";
  }
}

export function LiveComposerTransport({
  inputAudioLevel,
  microphoneEnabled,
  onMicrophoneEnabledChange,
  onStart,
  onStop,
  onVideoButtonClick,
  outputAudioLevel,
  status,
  videoEnabled,
  videoSupported,
}: LiveComposerTransportProps) {
  const isActive = status === "active";
  const isConnecting = status === "connecting";

  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <button
        type="button"
        disabled={isConnecting}
        onClick={isActive ? onStop : onStart}
        aria-label={isActive ? "Pause live session" : "Start live session"}
        title={isActive ? "Pause live session" : "Start live session"}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          isActive
            ? "bg-human-action text-human-action-foreground hover:bg-human-action/88"
            : "bg-surface text-foreground hover:bg-selection",
        )}
      >
        {isConnecting ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : isActive ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <AudioLines className="h-5 w-5 fill-current" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-label={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
        aria-pressed={microphoneEnabled}
        title={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
        onClick={() => onMicrophoneEnabledChange(!microphoneEnabled)}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
          microphoneEnabled
            ? "bg-success text-canvas hover:bg-success/88"
            : "bg-failure text-canvas hover:bg-failure/88",
        )}
      >
        {microphoneEnabled ? (
          <Mic className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MicOff className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      <LiveAudioLevelMeter
        inputAudioLevel={inputAudioLevel}
        isActive={isActive}
        microphoneEnabled={microphoneEnabled}
        outputAudioLevel={outputAudioLevel}
      />
      <button
        type="button"
        aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
        aria-pressed={videoEnabled}
        disabled={!videoSupported}
        title={
          videoSupported
            ? videoEnabled
              ? "Turn camera off"
              : "Turn camera on"
            : "Camera is available with Gemini Live"
        }
        onClick={onVideoButtonClick}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-45",
          videoEnabled
            ? "bg-active-work text-canvas hover:bg-active-work/88"
            : "bg-surface text-foreground hover:bg-selection",
        )}
      >
        {videoEnabled ? (
          <Video className="h-5 w-5" aria-hidden="true" />
        ) : (
          <VideoOff className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
