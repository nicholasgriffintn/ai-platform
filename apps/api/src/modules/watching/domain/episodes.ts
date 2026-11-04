import type { ViewingStatus } from "./titles";

export interface EpisodeRef {
  season: number;
  episode: number;
}

export interface SeasonSize {
  season: number;
  episodes: number;
}

export function isEpisodeAtOrAfter(left: EpisodeRef, right: EpisodeRef): boolean {
  return (
    left.season > right.season || (left.season === right.season && left.episode >= right.episode)
  );
}

export function listEpisodesThrough(
  seasons: readonly SeasonSize[],
  target: EpisodeRef,
): EpisodeRef[] {
  return [...seasons]
    .filter((entry) => entry.season > 0 && entry.season <= target.season)
    .sort((left, right) => left.season - right.season)
    .flatMap((entry) => {
      const last = entry.season === target.season ? target.episode : entry.episodes;

      return Array.from({ length: last }, (_, index) => ({
        season: entry.season,
        episode: index + 1,
      }));
    });
}

export function rollUpShelfStatus(
  current: ViewingStatus | undefined,
  finished: boolean,
): ViewingStatus {
  return finished || current === "watched" ? "watched" : "watching";
}
