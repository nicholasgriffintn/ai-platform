import { useEffect, useState } from "react";

import { useMediaTrack } from "./useMediaTrack.js";

export interface PlaybackPassage {
  audio: boolean;
  pauseSeconds?: number;
}

export type PassagePhase = "idle" | "waiting" | "speaking" | "resting" | "finished";

export function usePassagePlayback(
  key: string | null,
  passages: readonly PlaybackPassage[],
  complete: boolean,
) {
  const [currentKey, setCurrentKey] = useState(key);
  const [step, setStep] = useState(0);
  const [resting, setResting] = useState(false);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [run, setRun] = useState(0);
  const track = useMediaTrack(() => setResting(true));
  const passage = passages[step];
  const finished = complete && step >= passages.length;

  if (key !== currentKey) {
    setCurrentKey(key);
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
      (passage?.pauseSeconds ?? 0) * 1000,
    );

    return () => window.clearTimeout(timer);
  }, [passage?.pauseSeconds, resting, wantsPlay]);

  const playing = wantsPlay && !finished;
  const phase: PassagePhase = finished
    ? "finished"
    : !playing
      ? "idle"
      : resting
        ? "resting"
        : passage?.audio
          ? "speaking"
          : "waiting";

  return {
    track,
    step,
    phase,
    run,
    wantsPlay,
    playing,
    ended: wantsPlay && finished,
    audible: (passage?.audio ?? false) && !resting && !finished,
    begin: () => {
      setStep(0);
      setResting(false);
      setRun((value) => value + 1);
      setWantsPlay(true);
    },
    toggle: () => {
      if (playing) {
        track.pause();
        setWantsPlay(false);
      } else if (finished) {
        setStep(0);
        setResting(false);
        setRun((value) => value + 1);
        setWantsPlay(true);
      } else {
        setWantsPlay(true);
        track.play();
      }
    },
    resume: () => {
      setWantsPlay(true);
      track.play();
    },
    stop: () => {
      track.pause();
      setWantsPlay(false);
    },
    seek: (index: number) => {
      setStep(index);
      setResting(false);
    },
  };
}
