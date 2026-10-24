import type { DiscoverWindDown } from "@ngriffin_uk/polychat-schemas";
import { useMediaTrack } from "@ngriffin_uk/polychat-utility-react";
import { useEffect, useState } from "react";

export type WindDownPhase = "idle" | "waiting" | "speaking" | "resting" | "finished";

export function useWindDownPlayback(windDown: DiscoverWindDown | undefined) {
  const [sessionId, setSessionId] = useState(windDown?.id ?? null);
  const [step, setStep] = useState(0);
  const [resting, setResting] = useState(false);
  const [wantsPlay, setWantsPlay] = useState(false);
  const track = useMediaTrack(() => setResting(true));
  const steps = windDown?.steps ?? [];
  const current = steps[step];
  const finished = windDown?.status === "ready" && step >= steps.length;

  if ((windDown?.id ?? null) !== sessionId) {
    setSessionId(windDown?.id ?? null);
    setStep(0);
    setResting(false);
  }

  useEffect(() => {
    if (!resting || !wantsPlay) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => {
        setResting(false);
        setStep((index) => index + 1);
      },
      (current?.pauseSeconds ?? 0) * 1000,
    );

    return () => window.clearTimeout(timer);
  }, [current?.pauseSeconds, resting, wantsPlay]);

  const playing = wantsPlay && !finished;
  const phase: WindDownPhase = finished
    ? "finished"
    : !playing
      ? "idle"
      : resting
        ? "resting"
        : current?.audio
          ? "speaking"
          : "waiting";

  return {
    track,
    step,
    current,
    phase,
    wantsPlay: playing,
    audible: (current?.audio ?? false) && !resting && !finished,
    begin: () => {
      setStep(0);
      setResting(false);
      setWantsPlay(true);
    },
    toggle: () => {
      if (playing) {
        track.pause();
        setWantsPlay(false);
      } else {
        setWantsPlay(true);
        track.play();
      }
    },
    seekStep: (index: number) => {
      setStep(index);
      setResting(false);
    },
  };
}
