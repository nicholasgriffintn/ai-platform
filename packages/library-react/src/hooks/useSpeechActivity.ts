import { useEffect, useRef, useState } from "react";

const DEFAULT_SPEECH_LEVEL_THRESHOLD = 0.05;
const DEFAULT_SILENCE_HANGOVER_MS = 1500;

export interface SpeechActivity {
  isSpeechDetected: boolean;
  lastSilenceAt: number;
}

const SILENT: SpeechActivity = { isSpeechDetected: false, lastSilenceAt: 0 };

export function useSpeechActivity(
  level: number,
  enabled: boolean,
  {
    levelThreshold = DEFAULT_SPEECH_LEVEL_THRESHOLD,
    silenceHangoverMs = DEFAULT_SILENCE_HANGOVER_MS,
  }: { levelThreshold?: number; silenceHangoverMs?: number } = {},
): SpeechActivity {
  const [activity, setActivity] = useState<SpeechActivity>(SILENT);
  const hangoverTimerRef = useRef<number | null>(null);
  const isSpeaking = enabled && level >= levelThreshold;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (isSpeaking) {
      return undefined;
    }

    hangoverTimerRef.current = window.setTimeout(() => {
      hangoverTimerRef.current = null;
      setActivity((current) =>
        current.isSpeechDetected ? { isSpeechDetected: false, lastSilenceAt: Date.now() } : current,
      );
    }, silenceHangoverMs);

    return () => {
      if (hangoverTimerRef.current !== null) {
        window.clearTimeout(hangoverTimerRef.current);
        hangoverTimerRef.current = null;
      }
    };
  }, [enabled, isSpeaking, silenceHangoverMs]);

  if (isSpeaking && !activity.isSpeechDetected) {
    setActivity({ isSpeechDetected: true, lastSilenceAt: 0 });
  }

  if (
    !enabled &&
    activity !== SILENT &&
    !activity.isSpeechDetected &&
    activity.lastSilenceAt !== 0
  ) {
    setActivity(SILENT);
  }

  return enabled ? activity : SILENT;
}
