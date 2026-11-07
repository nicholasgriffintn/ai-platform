import { MONTH_DAYS, YEAR_DAYS, advanceTo, type World } from "@ngriffin_uk/polychat-library-polis";

import type { PolisPlaybackState, PolisPlaybackUnit } from "./protocol.js";

const HOURS_PER_DAY = 24;
const STEP_BUDGET_MS = 11;
const HOURS_PER_SECOND = 6;
const HOUR_ROUNDING = 1e-6;

const DAYS_PER_SECOND: Record<PolisPlaybackUnit, number> = {
  hours: HOURS_PER_SECOND / HOURS_PER_DAY,
  days: 3,
  months: MONTH_DAYS * 2,
  years: YEAR_DAYS * 1.5,
};

const UNIT_DAYS: Record<Exclude<PolisPlaybackUnit, "hours">, number> = {
  days: 1,
  months: MONTH_DAYS,
  years: YEAR_DAYS,
};

export interface Playback {
  world: World;
  position: number;
  playing: boolean;
  unit: PolisPlaybackUnit;
}

export function createPlayback(world: World, position: number): Playback {
  return { world, position, playing: false, unit: "days" };
}

export function positionFor(day: number, hour: number): number {
  return day + hour / HOURS_PER_DAY;
}

export function nudgedPosition(
  playback: Playback,
  unit: PolisPlaybackUnit,
  direction: 1 | -1,
): number {
  return playback.position + direction * (unit === "hours" ? 1 / HOURS_PER_DAY : UNIT_DAYS[unit]);
}

export function nearestKeyframe(keyframes: readonly World[], day: number): World | null {
  let best: World | null = null;

  for (const keyframe of keyframes) {
    if (keyframe.day <= day && (!best || keyframe.day > best.day)) {
      best = keyframe;
    }
  }

  return best;
}

export function shouldJump(
  playback: Playback,
  keyframe: World | null,
  day: number,
): keyframe is World {
  if (!keyframe) {
    return false;
  }

  return day < playback.world.day || keyframe.day > playback.world.day;
}

export function advancePosition(playback: Playback, elapsedMs: number, endDay: number): void {
  if (!playback.playing) {
    return;
  }

  playback.position += (elapsedMs / 1000) * DAYS_PER_SECOND[playback.unit];

  if (playback.position >= endDay) {
    playback.position = endDay;
    playback.playing = false;
  }
}

export function catchUp(playback: Playback, source: World, now: number): boolean {
  return advanceTo(playback.world, source.log, Math.floor(playback.position), now + STEP_BUDGET_MS);
}

export function dayFractionOf(playback: Playback): number {
  return playback.position % 1;
}

export function playbackState(
  playback: Playback,
  endDay: number,
  seeking: boolean,
): PolisPlaybackState {
  const day = Math.floor(playback.position);

  return {
    day,
    hour: Math.floor((playback.position - day) * HOURS_PER_DAY + HOUR_ROUNDING),
    endDay,
    playing: playback.playing,
    unit: playback.unit,
    seeking,
  };
}
