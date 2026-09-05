import { Button, cn, ShortcutTooltip } from "@ngriffin_uk/polychat-component-ui";
import { AudioWaveform, Loader2, Mic, Square } from "lucide-react";
import type { ReactNode } from "react";

interface ComposerShortcutActionProps {
  ariaKeyShortcuts: string;
  disabled?: boolean;
  icon: ReactNode;
  isActive?: boolean;
  label: string;
  onClick: () => void;
  shortcut: string[];
}

function ComposerShortcutAction({
  ariaKeyShortcuts,
  disabled,
  icon,
  isActive = false,
  label,
  onClick,
  shortcut,
}: ComposerShortcutActionProps) {
  return (
    <ShortcutTooltip keys={shortcut} label={label}>
      <Button
        type="button"
        variant={isActive ? "iconActive" : "icon"}
        size="sm"
        className="h-8 w-8 shrink-0 rounded-md p-1.5"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-keyshortcuts={ariaKeyShortcuts}
      >
        {icon}
      </Button>
    </ShortcutTooltip>
  );
}

export interface ComposerVoiceControlsProps {
  className?: string;
  dictate?: {
    disabled?: boolean;
    isRecording: boolean;
    isTranscribing: boolean;
    onStart: () => void | Promise<void>;
    onStop: () => void | Promise<void>;
  };
  live?: {
    disabled?: boolean;
    isActive: boolean;
    onToggle: () => void;
  };
}

export function ComposerVoiceControls({ className, dictate, live }: ComposerVoiceControlsProps) {
  if (!dictate && !live) {
    return null;
  }

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)} aria-label="Voice controls">
      {dictate ? (
        <ComposerShortcutAction
          ariaKeyShortcuts="Control+Shift+D"
          disabled={dictate.disabled || dictate.isTranscribing}
          icon={
            dictate.isRecording ? (
              <Square className="h-3.5 w-3.5 fill-current text-failure" aria-hidden="true" />
            ) : dictate.isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mic className="h-4 w-4" aria-hidden="true" />
            )
          }
          isActive={dictate.isRecording}
          label={dictate.isRecording ? "Stop dictating" : "Dictate"}
          onClick={() => {
            void (dictate.isRecording ? dictate.onStop : dictate.onStart)();
          }}
          shortcut={["⌃", "⇧", "D"]}
        />
      ) : null}
      {live ? (
        <ComposerShortcutAction
          ariaKeyShortcuts="Control+Shift+V"
          disabled={live.disabled}
          icon={<AudioWaveform className="h-4 w-4" aria-hidden="true" />}
          isActive={live.isActive}
          label={live.isActive ? "Exit Live" : "Start Live"}
          onClick={live.onToggle}
          shortcut={["⌃", "⇧", "V"]}
        />
      ) : null}
    </div>
  );
}
