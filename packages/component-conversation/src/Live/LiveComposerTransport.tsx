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
            ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-off-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            : "bg-white text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
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
            ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200"
            : "bg-red-600 text-zinc-500 hover:bg-red-700 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800",
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
            ? "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-300 dark:text-sky-950 dark:hover:bg-sky-200"
            : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
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
