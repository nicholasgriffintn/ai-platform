import type { DiscoverWindDown } from "@ngriffin_uk/polychat-schemas";
import {
  usePassagePlayback,
  useRunningSeconds,
  type PassagePhase,
} from "@ngriffin_uk/polychat-utility-react";

export type WindDownPhase = PassagePhase;

export function useWindDownPlayback(windDown: DiscoverWindDown | undefined) {
  const steps = windDown?.steps ?? [];
  const voiced = usePassagePlayback(windDown?.id ?? null, steps, windDown?.status === "ready");
  const soundOnly = windDown?.kind === "sound";
  const soundTotal = (windDown?.minutes ?? 0) * 60;
  const soundSeconds = useRunningSeconds(
    voiced.wantsPlay && soundOnly,
    `${windDown?.id ?? ""}:${voiced.run}`,
  );
  const soundFinished = soundTotal > 0 && soundSeconds >= soundTotal;

  if (!soundOnly) {
    return {
      ...voiced,
      current: steps[voiced.step],
      wantsPlay: voiced.playing,
      position: { value: Math.min(voiced.step, steps.length), max: steps.length },
    };
  }

  const playing = voiced.wantsPlay && !soundFinished;
  const phase: WindDownPhase = soundFinished ? "finished" : playing ? "resting" : "idle";

  return {
    ...voiced,
    current: undefined,
    wantsPlay: playing,
    ended: voiced.wantsPlay && soundFinished,
    audible: false,
    phase,
    position: { value: Math.min(soundSeconds, soundTotal), max: soundTotal },
    toggle: playing ? voiced.stop : soundFinished ? voiced.begin : voiced.resume,
  };
}
