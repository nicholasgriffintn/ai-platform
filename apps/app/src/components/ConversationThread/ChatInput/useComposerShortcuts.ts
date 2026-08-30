import { useEffect } from "react";

import { matchesAppKeyboardShortcut } from "~/lib/keyboard-shortcuts";

interface ComposerShortcutOptions {
  dictate?: {
    enabled: boolean;
    isRecording: boolean;
    onStart: () => void | Promise<void>;
    onStop: () => void | Promise<void>;
  };
  live?: {
    enabled: boolean;
    onToggle: () => void;
  };
}

export function useComposerShortcuts({ dictate, live }: ComposerShortcutOptions) {
  const dictateEnabled = dictate?.enabled;
  const isRecording = dictate?.isRecording;
  const onStartDictating = dictate?.onStart;
  const onStopDictating = dictate?.onStop;
  const liveEnabled = live?.enabled;
  const onToggleLive = live?.onToggle;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (dictateEnabled && matchesAppKeyboardShortcut(event, "dictate")) {
        event.preventDefault();
        if (isRecording) {
          void onStopDictating?.();
        } else {
          void onStartDictating?.();
        }

        return;
      }

      if (liveEnabled && matchesAppKeyboardShortcut(event, "live")) {
        event.preventDefault();
        onToggleLive?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dictateEnabled, isRecording, liveEnabled, onStartDictating, onStopDictating, onToggleLive]);
}
