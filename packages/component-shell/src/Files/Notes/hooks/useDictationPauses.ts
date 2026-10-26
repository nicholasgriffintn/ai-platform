import { useCallback, useEffect, useRef } from "react";

import { DICTATION_PARAGRAPH_PAUSE_MS } from "../dictation.js";

export function useDictationPauses({
  isActive,
  isSpeechDetected,
  lastSilenceAt,
}: {
  isActive: boolean;
  isSpeechDetected: boolean;
  lastSilenceAt: number;
}) {
  const silenceSinceRef = useRef<number | null>(null);
  const breakPendingRef = useRef(true);

  useEffect(() => {
    if (!isActive) {
      silenceSinceRef.current = null;
      breakPendingRef.current = true;

      return;
    }

    if (lastSilenceAt > 0) {
      silenceSinceRef.current = lastSilenceAt;

      return;
    }

    if (isSpeechDetected && silenceSinceRef.current !== null) {
      if (Date.now() - silenceSinceRef.current >= DICTATION_PARAGRAPH_PAUSE_MS) {
        breakPendingRef.current = true;
      }

      silenceSinceRef.current = null;
    }
  }, [isActive, isSpeechDetected, lastSilenceAt]);

  return useCallback(() => {
    const startsParagraph = breakPendingRef.current;

    breakPendingRef.current = false;

    return startsParagraph;
  }, []);
}
