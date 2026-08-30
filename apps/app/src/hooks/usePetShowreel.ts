import {
  type PetClipName,
  type PetSheetLayout,
  POLYCHAT_SHEET_LAYOUT,
} from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef, useState } from "react";

const SHOWREEL_CLIPS: readonly PetClipName[] = [
  "idle",
  "blink",
  "preen",
  "greet",
  "think",
  "work",
  "speak",
  "cheer",
  "fret",
  "flit",
];

const MIN_HOLD_MS = 1600;
const FLIP_CHANCE = 0.28;

export interface PetShowreel {
  clip: PetClipName;
  facing: "left" | "right";
}

const RESTING: PetShowreel = { clip: "idle", facing: "right" };

function availableClips(layout: PetSheetLayout): readonly PetClipName[] {
  const present = SHOWREEL_CLIPS.filter((clip) => layout.clips[clip]);

  return present.length > 0 ? present : ["idle"];
}

function pick(layout: PetSheetLayout, exclude: PetClipName): PetClipName {
  const available = availableClips(layout);
  const options = available.filter((clip) => clip !== exclude);
  const pool = options.length > 0 ? options : available;

  return pool[Math.floor(Math.random() * pool.length)];
}

function holdFor(layout: PetSheetLayout, clip: PetClipName): number {
  const entry = layout.clips[clip] ?? layout.clips.idle;
  const duration = entry ? (entry.frames / entry.fps) * 1000 * 2 : MIN_HOLD_MS;

  return Math.max(MIN_HOLD_MS, duration) + Math.random() * 900;
}

export function usePetShowreel(
  active: boolean,
  layout: PetSheetLayout = POLYCHAT_SHEET_LAYOUT,
): PetShowreel {
  const [state, setState] = useState<PetShowreel>(RESTING);
  const currentRef = useRef<PetShowreel>(RESTING);

  useEffect(() => {
    if (!active) {
      currentRef.current = RESTING;
      setState(RESTING);

      return;
    }

    let timeout = 0;
    let cancelled = false;

    function advance() {
      if (cancelled) {
        return;
      }

      const current = currentRef.current;
      const clip = pick(layout, current.clip);
      const facing =
        Math.random() < FLIP_CHANCE
          ? current.facing === "right"
            ? "left"
            : "right"
          : current.facing;
      const next: PetShowreel = { clip, facing };

      currentRef.current = next;
      setState(next);

      timeout = window.setTimeout(advance, holdFor(layout, clip));
    }

    timeout = window.setTimeout(advance, holdFor(layout, currentRef.current.clip));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [active, layout]);

  return state;
}
