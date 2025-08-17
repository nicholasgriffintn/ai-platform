import { Volume2, VolumeX } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { cn } from "~/lib/utils";

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
    } else {
      setSilenceDuration(0);
    }
  }, [isSpeechDetected, lastSilenceTime]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute bottom-16 left-4 right-4 p-3 bg-gray-100 dark:bg-gray-800 rounded shadow-md border border-gray-200 dark:border-gray-700 max-h-32 overflow-y-auto"
      aria-live="polite"
    >
      <div className="flex items-center mb-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium mr-2">Status:</span>
        <span
          className={cn(
            "px-2 py-0.5 rounded text-xs",
            transcriptionStatus === "active"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              : transcriptionStatus === "connecting"
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                : transcriptionStatus === "reconnecting"
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
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
            <span className="flex items-center text-green-600 dark:text-green-400">
              <Volume2 size={14} className="mr-1 animate-pulse" />
              Speech detected
            </span>
          ) : (
            <span className="flex items-center text-gray-500 dark:text-gray-400">
              <VolumeX size={14} className="mr-1" />
              Silence {silenceDuration > 0 ? `(${silenceDuration}s)` : ""}
            </span>
          )}
        </div>
      </div>
      {partialTranscript ? (
        <p className="text-sm opacity-70 text-gray-500 dark:text-gray-400 italic">
          {partialTranscript}
        </p>
      ) : (
        <p className="text-sm opacity-50 text-gray-500 dark:text-gray-400 animate-pulse">
          {isSpeechDetected ? "Listening..." : "Waiting for speech..."}
        </p>
      )}
    </div>
  );
});
