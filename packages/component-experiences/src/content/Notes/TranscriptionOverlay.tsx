import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Volume2, VolumeX } from "lucide-react";
import { memo, useEffect, useState } from "react";

interface TranscriptionOverlayProps {
  isVisible: boolean;
  transcriptionStatus: string;
  isSpeechDetected: boolean;
  lastSilenceTime: number;
  partialTranscript: string;
}

export const TranscriptionOverlay = memo(function TranscriptionOverlay({
  isVisible,
  transcriptionStatus,
  isSpeechDetected,
  lastSilenceTime,
  partialTranscript,
}: TranscriptionOverlayProps) {
  const [silenceDuration, setSilenceDuration] = useState(0);

  useEffect(() => {
    if (!isSpeechDetected && lastSilenceTime > 0) {
      const interval = setInterval(() => {
        setSilenceDuration(Math.floor((Date.now() - lastSilenceTime) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }

    setSilenceDuration(0);
  }, [isSpeechDetected, lastSilenceTime]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="border-border bg-surface-elevated absolute right-4 bottom-16 left-4 max-h-32 overflow-y-auto rounded border p-3 shadow-[var(--polychat-elevated-shadow)]"
      aria-live="polite"
    >
      <div className="flex items-center mb-1 text-xs text-muted-foreground">
        <span className="font-medium mr-2">Status:</span>
        <span
          className={cn(
            "px-2 py-0.5 rounded text-xs",
            transcriptionStatus === "active"
              ? "bg-success/12 text-success"
              : transcriptionStatus === "connecting"
                ? "bg-attention/12 text-attention"
                : transcriptionStatus === "reconnecting"
                  ? "bg-attention/12 text-attention"
                  : "bg-failure/12 text-failure",
          )}
        >
          {transcriptionStatus === "active"
            ? "Active"
            : transcriptionStatus === "connecting"
              ? "Connecting..."
              : transcriptionStatus === "reconnecting"
                ? "Reconnecting..."
                : "Error"}
        </span>
        <div className="ml-auto flex items-center">
          {isSpeechDetected ? (
            <span className="flex items-center text-success">
              <Volume2 size={14} className="mr-1 animate-pulse" />
              Speech detected
            </span>
          ) : (
            <span className="flex items-center text-muted-foreground">
              <VolumeX size={14} className="mr-1" />
              Silence {silenceDuration > 0 ? `(${silenceDuration}s)` : ""}
            </span>
          )}
        </div>
      </div>
      {partialTranscript ? (
        <p className="text-sm opacity-70 text-muted-foreground italic">{partialTranscript}</p>
      ) : (
        <p className="text-sm opacity-50 text-muted-foreground animate-pulse">
          {isSpeechDetected ? "Listening..." : "Waiting for speech..."}
        </p>
      )}
    </div>
  );
});
