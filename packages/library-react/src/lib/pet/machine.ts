import type { PetStateName } from "@ngriffin_uk/polychat-schemas";

export const PET_MIN_DWELL_MS = 700;

const URGENT_STATES: ReadonlySet<PetStateName> = new Set(["fret", "listen", "review"]);

export interface PetMotion {
  shown: PetStateName;
  since: number;
  queued: PetStateName | null;
}

export function startPetMotion(state: PetStateName, now: number): PetMotion {
  return { shown: state, since: now, queued: null };
}

export function petDwellRemaining(
  motion: PetMotion,
  now: number,
  minimumMs: number = PET_MIN_DWELL_MS,
): number {
  return Math.max(0, motion.since + minimumMs - now);
}

export function stepPetMotion(
  motion: PetMotion,
  target: PetStateName,
  now: number,
  minimumMs: number = PET_MIN_DWELL_MS,
): PetMotion {
  if (target === motion.shown) {
    return motion.queued === null ? motion : { ...motion, queued: null };
  }

  if (URGENT_STATES.has(target) || petDwellRemaining(motion, now, minimumMs) === 0) {
    return startPetMotion(target, now);
  }

  return motion.queued === target ? motion : { ...motion, queued: target };
}

export function settlePetMotion(
  motion: PetMotion,
  now: number,
  minimumMs: number = PET_MIN_DWELL_MS,
): PetMotion {
  if (motion.queued === null || petDwellRemaining(motion, now, minimumMs) > 0) {
    return motion;
  }

  return startPetMotion(motion.queued, now);
}
