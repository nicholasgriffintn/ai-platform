import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Hand, Mic, MicOff } from "lucide-react";

export interface LivePushToTalkControls {
  enabled: boolean;
  talking: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onTalkStart: () => void;
  onTalkEnd: () => void;
}

type LiveControlSize = "sm" | "md";

const BUTTON_SIZE_CLASS: Record<LiveControlSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

const ICON_SIZE_CLASS: Record<LiveControlSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

const MICROPHONE_STATE_CLASS: Record<LiveControlSize, { on: string; off: string; held: string }> = {
  sm: {
    on: "bg-success/12 text-success hover:bg-success/20",
    off: "bg-surface-elevated text-muted-foreground hover:bg-selection hover:text-foreground",
    held: "bg-surface-elevated text-muted-foreground hover:bg-selection hover:text-foreground",
  },
  md: {
    on: "bg-success text-canvas hover:bg-success/88",
    off: "bg-failure text-canvas hover:bg-failure/88",
    held: "bg-surface text-foreground hover:bg-selection",
  },
};

export interface LiveMicrophoneButtonProps {
  microphoneEnabled: boolean;
  onMicrophoneEnabledChange: (enabled: boolean) => void;
  pushToTalk?: LivePushToTalkControls;
  size: LiveControlSize;
}

export function LiveMicrophoneButton({
  microphoneEnabled,
  onMicrophoneEnabledChange,
  pushToTalk,
  size,
}: LiveMicrophoneButtonProps) {
  const stateClass = MICROPHONE_STATE_CLASS[size];
  const iconClassName = ICON_SIZE_CLASS[size];
  const baseClassName = cn(
    "flex shrink-0 touch-none items-center justify-center rounded-md transition-colors select-none",
    BUTTON_SIZE_CLASS[size],
  );

  if (pushToTalk?.enabled) {
    const { onTalkEnd, onTalkStart, talking } = pushToTalk;

    return (
      <button
        type="button"
        aria-label="Hold to talk"
        aria-pressed={talking}
        title="Hold to talk, or hold Space"
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          event.currentTarget.setPointerCapture(event.pointerId);
          onTalkStart();
        }}
        onPointerUp={onTalkEnd}
        onPointerCancel={onTalkEnd}
        onLostPointerCapture={onTalkEnd}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(baseClassName, talking ? stateClass.on : stateClass.held)}
      >
        {talking ? (
          <Mic className={iconClassName} aria-hidden="true" />
        ) : (
          <MicOff className={iconClassName} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
      aria-pressed={microphoneEnabled}
      title={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
      onClick={() => onMicrophoneEnabledChange(!microphoneEnabled)}
      className={cn(baseClassName, microphoneEnabled ? stateClass.on : stateClass.off)}
    >
      {microphoneEnabled ? (
        <Mic className={iconClassName} aria-hidden="true" />
      ) : (
        <MicOff className={iconClassName} aria-hidden="true" />
      )}
    </button>
  );
}

export function LivePushToTalkToggle({
  pushToTalk,
  size,
}: {
  pushToTalk: LivePushToTalkControls;
  size: LiveControlSize;
}) {
  const { enabled, onEnabledChange } = pushToTalk;

  return (
    <button
      type="button"
      aria-label="Push to talk"
      aria-pressed={enabled}
      title={enabled ? "Push to talk is on" : "Push to talk is off"}
      onClick={() => onEnabledChange(!enabled)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md transition-colors",
        BUTTON_SIZE_CLASS[size],
        enabled
          ? "bg-selection text-foreground hover:bg-selection/80"
          : size === "sm"
            ? "bg-surface-elevated text-muted-foreground hover:bg-selection hover:text-foreground"
            : "bg-surface text-muted-foreground hover:bg-selection hover:text-foreground",
      )}
    >
      <Hand className={ICON_SIZE_CLASS[size]} aria-hidden="true" />
    </button>
  );
}
