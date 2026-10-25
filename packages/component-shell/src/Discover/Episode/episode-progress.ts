import type { DiscoverEpisode } from "@ngriffin_uk/polychat-schemas";

import { chapterSeconds } from "./episode-status.js";

export const PROGRESS_STEPS = 4;
export const RESUME_INTERVAL_SECONDS = 15;

export function watchedFraction(
  episode: DiscoverEpisode,
  chapterIndex: number,
  seconds: number,
): number {
  const lengths = episode.chapters.map(chapterSeconds);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const before = lengths.slice(0, chapterIndex).reduce((sum, length) => sum + length, 0);

  return total > 0 ? Math.min(1, (before + seconds) / total) : 0;
}

export function progressMark(chapterIndex: number, seconds: number, playing: boolean): string {
  return playing
    ? `${chapterIndex}:${Math.floor(seconds / RESUME_INTERVAL_SECONDS)}`
    : `${chapterIndex}:paused`;
}
