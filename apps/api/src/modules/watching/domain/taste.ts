import { normaliseVector } from "@ngriffin_uk/polychat-utility-core";

import { countWatchedEpisodes, type ShelfEntry } from "./shelf";
import type { TitleSummary, ViewingStatus } from "./titles";

const STATUS_WEIGHTS: Record<ViewingStatus, number> = {
  watched: 0.3,
  watching: 0.3,
  watchlist: 0.15,
  dropped: -0.5,
};
const RATING_MIDPOINT = 2.5;
const MIN_IMDB_RATING = 6.5;
const MIN_IMDB_VOTES = 5000;
const MIN_TMDB_SCORE = 7;

export interface TasteVector {
  id: string;
  values: readonly number[];
  weight: number;
}

export function tasteWeight(entry: Pick<ShelfEntry, "status" | "rating">): number {
  return entry.rating == null || entry.status === "dropped"
    ? STATUS_WEIGHTS[entry.status]
    : (entry.rating - RATING_MIDPOINT) / RATING_MIDPOINT;
}

function compareStrength(left: ShelfEntry, right: ShelfEntry): number {
  return (
    tasteWeight(right) - tasteWeight(left) ||
    countWatchedEpisodes(right) - countWatchedEpisodes(left)
  );
}

function alternateMedia(entries: readonly ShelfEntry[]): ShelfEntry[] {
  const turns = new Map<string, number>();

  return entries
    .map((entry) => {
      const turn = turns.get(entry.mediaType) ?? 0;

      turns.set(entry.mediaType, turn + 1);

      return { entry, turn };
    })
    .sort((left, right) => left.turn - right.turn)
    .map(({ entry }) => entry);
}

function hasOpinion(entry: ShelfEntry): boolean {
  return entry.rating != null || entry.status === "dropped";
}

export function selectTasteEntries(entries: readonly ShelfEntry[], size: number): ShelfEntry[] {
  const opinions = entries
    .filter(hasOpinion)
    .sort((left, right) => Math.abs(tasteWeight(right)) - Math.abs(tasteWeight(left)));
  const rest = entries.filter((entry) => !hasOpinion(entry)).sort(compareStrength);

  return [...opinions, ...alternateMedia(rest)].slice(0, size);
}

export function selectTasteAnchors(entries: readonly ShelfEntry[], size: number): ShelfEntry[] {
  const liked = entries
    .filter(
      (entry) =>
        (entry.status === "watched" || entry.status === "watching") && tasteWeight(entry) > 0,
    )
    .sort(compareStrength);

  return alternateMedia(liked).slice(0, size);
}

export function interleaveMatches(
  lists: readonly (readonly string[])[],
  excluded: ReadonlySet<string>,
): string[] {
  const fresh = lists.map((list) => list.filter((id) => !excluded.has(id)));
  const depth = Math.max(0, ...fresh.map((list) => list.length));
  const picked = new Set<string>();

  for (let rank = 0; rank < depth; rank += 1) {
    for (const list of fresh) {
      const id = list[rank];

      if (id) {
        picked.add(id);
      }
    }
  }

  return [...picked];
}

export function isWorthRecommending(title: TitleSummary): boolean {
  return title.imdbRating == null
    ? (title.tmdbScore ?? 0) >= MIN_TMDB_SCORE
    : title.imdbRating >= MIN_IMDB_RATING && (title.imdbVotes ?? 0) >= MIN_IMDB_VOTES;
}

export function blendTaste(vectors: readonly TasteVector[]): number[] {
  const width = vectors[0]?.values.length ?? 0;
  const blended = Array.from({ length: width }, () => 0);

  for (const vector of vectors) {
    vector.values.forEach((value, index) => {
      blended[index] = (blended[index] ?? 0) + value * vector.weight;
    });
  }

  return normaliseVector(blended);
}
