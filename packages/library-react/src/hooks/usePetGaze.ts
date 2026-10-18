import { type RefObject, useEffect, useState } from "react";

import { gazeAngleBetween, gazeDistance, type PetGazeDirection } from "../lib/pet/gaze.js";
import { usePetStore } from "../state/stores/petStore.js";

export const POLY_ANCHOR_ATTRIBUTE = "data-poly-anchor";

const FOCUS_GAZE_MS = 2500;

export function findPolyAnchor(anchor: string, near?: Element | null): HTMLElement | null {
  const candidates = [
    ...document.querySelectorAll<HTMLElement>(`[${POLY_ANCHOR_ATTRIBUTE}="${CSS.escape(anchor)}"]`),
  ].filter((element) => element.getClientRects().length > 0);

  if (!near || candidates.length < 2) {
    return candidates[0] ?? null;
  }

  const origin = near.getBoundingClientRect();

  return candidates.reduce((closest, candidate) =>
    gazeDistance(origin, candidate.getBoundingClientRect()) <
    gazeDistance(origin, closest.getBoundingClientRect())
      ? candidate
      : closest,
  );
}

export function usePetGaze(
  petRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): PetGazeDirection | null {
  const gaze = usePetStore((state) => state.gaze);
  const lookAt = usePetStore((state) => state.lookAt);
  const clearGaze = usePetStore((state) => state.clearGaze);
  const [direction, setDirection] = useState<PetGazeDirection | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function follow(event: Event) {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target
        ?.closest(`[${POLY_ANCHOR_ATTRIBUTE}]`)
        ?.getAttribute(POLY_ANCHOR_ATTRIBUTE);

      if (anchor) {
        lookAt(anchor, FOCUS_GAZE_MS);
      }
    }

    document.addEventListener("focusin", follow);
    document.addEventListener("input", follow);

    return () => {
      document.removeEventListener("focusin", follow);
      document.removeEventListener("input", follow);
    };
  }, [enabled, lookAt]);

  useEffect(() => {
    if (!enabled || !gaze) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const pet = petRef.current;
      const target = findPolyAnchor(gaze.anchor, pet);

      setDirection(
        pet && target
          ? gazeAngleBetween(pet.getBoundingClientRect(), target.getBoundingClientRect())
          : null,
      );
    });
    const timeout = window.setTimeout(
      () => clearGaze(gaze.anchor),
      Math.max(0, gaze.until - Date.now()),
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [clearGaze, enabled, gaze, petRef]);

  return enabled && gaze ? direction : null;
}
