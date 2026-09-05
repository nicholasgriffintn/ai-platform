import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

const AUDIO_LEVEL_BAR_WEIGHTS = [0.42, 0.72, 1, 0.62, 0.9, 1.18, 0.76, 1.04, 0.58, 0.82, 0.46];
const ASSISTANT_AUDIO_LEVEL_THRESHOLD = 0.025;

export interface LiveMediaControlsProps {
  microphoneEnabled: boolean;
  onMicrophoneEnabledChange: (enabled: boolean) => void;
  onVideoButtonClick: () => void;
  videoEnabled: boolean;
  videoSupported: boolean;
}

export function LiveMediaControls({
  microphoneEnabled,
  onMicrophoneEnabledChange,
  onVideoButtonClick,
  videoEnabled,
  videoSupported,
}: LiveMediaControlsProps) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
        aria-pressed={microphoneEnabled}
        title={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
        onClick={() => onMicrophoneEnabledChange(!microphoneEnabled)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          microphoneEnabled
            ? "bg-success/12 text-success hover:bg-success/20"
            : "bg-surface-elevated text-muted-foreground hover:bg-selection hover:text-foreground",
        )}
      >
        {microphoneEnabled ? (
          <Mic className="h-4 w-4" aria-hidden="true" />
        ) : (
          <MicOff className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
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
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          videoEnabled
            ? "bg-active-work/12 text-active-work hover:bg-active-work/20"
            : "bg-surface-elevated text-muted-foreground hover:bg-selection hover:text-foreground",
        )}
      >
        {videoEnabled ? (
          <Video className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VideoOff className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function LiveAudioLevelMeter({
  inputAudioLevel = 0,
  isActive,
  microphoneEnabled,
  outputAudioLevel = 0,
}: {
  inputAudioLevel?: number;
  isActive: boolean;
  microphoneEnabled: boolean;
  outputAudioLevel?: number;
}) {
  const isAssistantAudio = outputAudioLevel > ASSISTANT_AUDIO_LEVEL_THRESHOLD;
  const level = isActive ? (isAssistantAudio ? outputAudioLevel : inputAudioLevel) : 0;
  const clampedLevel = Math.min(1, Math.max(0, level));
  const value = Math.round(clampedLevel * 100);
  const label = isAssistantAudio ? "Assistant audio level" : "Microphone audio level";
  const barClassName = isAssistantAudio ? "bg-active-work" : "bg-success";

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-3 transition-colors",
        isAssistantAudio
          ? "border-active-work/45 bg-active-work/12"
          : "border-success/45 bg-success/12",
        !isActive && "border-border bg-surface",
        isActive && !microphoneEnabled && !isAssistantAudio && "opacity-55",
      )}
    >
      {AUDIO_LEVEL_BAR_WEIGHTS.map((weight, index) => {
        const restingLevel = isActive ? 0.08 : 0.03;
        const weightedLevel = Math.max(restingLevel, Math.min(1, clampedLevel * weight));
        const height = Math.round(6 + weightedLevel * 28);

        return (
          <span
            key={`${weight}-${index}`}
            aria-hidden="true"
            className={cn(
              "w-1.5 rounded-full shadow-sm transition-[height,opacity,background-color] duration-100 ease-out",
              barClassName,
              !isActive && "bg-border-strong shadow-none",
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}
