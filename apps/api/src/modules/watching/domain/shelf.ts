import z from "zod/v4";

import type { EpisodeRef } from "./episodes";
import { MEDIA_TYPES, VIEWING_STATUSES, type MediaType, type ViewingStatus } from "./titles";

export const WATCHING_SHELF_KIND = "watching.shelf";
export const WATCHING_CAPABILITY_ID = "watching";
export const WATCHING_SHELF_GROUP = "watching:shelf";

const episodeSchema = z.object({
  season: z.number().int(),
  episode: z.number().int(),
  watched: z.boolean(),
  rating: z.number().int().nullable(),
  notes: z.string().nullable(),
});

const importedProgressSchema = z.object({
  seasons: z.array(z.object({ season: z.number().int(), watched: z.number().int() })),
  watched: z.number().int(),
  unwatched: z.number().int().nullable(),
});

const entrySchema = z.object({
  titleId: z.string(),
  imdbId: z.string().nullable().default(null),
  mediaType: z.enum(MEDIA_TYPES),
  title: z.string(),
  year: z.number().int().nullable(),
  status: z.enum(VIEWING_STATUSES),
  rating: z.number().int().nullable(),
  thoughts: z.string().nullable(),
  updatedAt: z.string(),
  episodes: z.array(episodeSchema),
  importedProgress: importedProgressSchema.nullable().default(null),
});

export const shelfContentSchema = z.object({
  entries: z.array(entrySchema),
  following: z.array(z.object({ tmdbPersonId: z.number().int(), name: z.string() })),
});

export type ShelfContent = z.infer<typeof shelfContentSchema>;
export type ShelfEntry = z.infer<typeof entrySchema>;

export interface ShelfEntryChange {
  titleId: string;
  mediaType: MediaType;
  title: string;
  year: number | null;
  status: ViewingStatus;
  rating?: number;
  thoughts?: string;
}

interface ImportedTitle {
  titleId: string;
  imdbId: string | null;
  mediaType: MediaType;
  title: string;
  year: number | null;
  rating: number | null;
  progress: ShelfEntry["importedProgress"];
}

export function emptyShelf(): ShelfContent {
  return { entries: [], following: [] };
}

export function findShelfEntry(shelf: ShelfContent, titleId: string): ShelfEntry | undefined {
  return shelf.entries.find((entry) => entry.titleId === titleId);
}

export function countWatchedEpisodes(
  entry: Pick<ShelfEntry, "episodes" | "importedProgress">,
): number {
  return Math.max(entry.episodes.length, entry.importedProgress?.watched ?? 0);
}

export function listRecentEntries(
  shelf: ShelfContent,
  statuses?: readonly ViewingStatus[],
): ShelfEntry[] {
  return shelf.entries
    .filter((entry) => !statuses || statuses.includes(entry.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function saveShelfEntry(shelf: ShelfContent, change: ShelfEntryChange): ShelfContent {
  const current = findShelfEntry(shelf, change.titleId);
  const entry: ShelfEntry = {
    titleId: change.titleId,
    imdbId: current?.imdbId ?? null,
    mediaType: change.mediaType,
    title: change.title,
    year: change.year,
    status: change.status,
    rating: change.rating ?? current?.rating ?? null,
    thoughts: change.thoughts ?? current?.thoughts ?? null,
    updatedAt: new Date().toISOString(),
    episodes: current?.episodes ?? [],
    importedProgress: current?.importedProgress ?? null,
  };

  return {
    ...shelf,
    entries: [...shelf.entries.filter((item) => item.titleId !== change.titleId), entry],
  };
}

function isSameEpisode(left: EpisodeRef, right: EpisodeRef): boolean {
  return left.season === right.season && left.episode === right.episode;
}

export function saveShelfEpisodes(
  entry: ShelfEntry,
  targets: readonly EpisodeRef[],
  watched: boolean,
  note: { target: EpisodeRef; rating?: number; notes?: string },
): ShelfEntry["episodes"] {
  const untouched = entry.episodes.filter(
    (episode) => !targets.some((target) => isSameEpisode(episode, target)),
  );
  const updated = targets.map((target) => {
    const current = entry.episodes.find((episode) => isSameEpisode(episode, target));
    const annotated = isSameEpisode(target, note.target);

    return {
      season: target.season,
      episode: target.episode,
      watched,
      rating: (annotated ? note.rating : undefined) ?? current?.rating ?? null,
      notes: (annotated ? note.notes : undefined) ?? current?.notes ?? null,
    };
  });

  return [...untouched, ...updated].sort(
    (left, right) => left.season - right.season || left.episode - right.episode,
  );
}

export function setShelfFollow(
  shelf: ShelfContent,
  person: { id: number; name: string },
  follow: boolean,
): ShelfContent {
  const others = shelf.following.filter((entry) => entry.tmdbPersonId !== person.id);

  return {
    ...shelf,
    following: follow ? [...others, { tmdbPersonId: person.id, name: person.name }] : others,
  };
}

function readWatchedStatus(title: ImportedTitle): ViewingStatus {
  return (title.progress?.unwatched ?? 0) > 0 ? "watching" : "watched";
}

export function mergeImportedLibrary(
  shelf: ShelfContent,
  library: {
    watched: readonly ImportedTitle[];
    ratings: readonly ImportedTitle[];
    watchlist: readonly ImportedTitle[];
  },
): { shelf: ShelfContent; added: number; updated: number } {
  const ratings = new Map(
    library.ratings.map((title) => [
      title.titleId,
      Math.max(1, Math.round((title.rating ?? 2) / 2)),
    ]),
  );
  const importable = [
    ...library.watched.map((title) => ({ title, status: readWatchedStatus(title) })),
    ...library.ratings.map((title) => ({ title, status: "watched" as const })),
    ...library.watchlist.map((title) => ({ title, status: "watchlist" as const })),
  ];
  const imported = new Map<string, (typeof importable)[number]>();

  for (const item of importable) {
    if (!imported.has(item.title.titleId)) {
      imported.set(item.title.titleId, item);
    }
  }

  const known = new Set(shelf.entries.map((entry) => entry.titleId));
  const now = new Date().toISOString();
  const added: ShelfEntry[] = [...imported.values()]
    .filter(({ title }) => !known.has(title.titleId))
    .map(({ title, status }) => ({
      titleId: title.titleId,
      imdbId: title.imdbId,
      mediaType: title.mediaType,
      title: title.title,
      year: title.year,
      status,
      rating: ratings.get(title.titleId) ?? null,
      thoughts: null,
      updatedAt: now,
      episodes: [],
      importedProgress: title.progress,
    }));
  let updated = 0;
  const existing = shelf.entries.map((entry) => {
    const title = imported.get(entry.titleId)?.title;
    const refreshed = {
      ...entry,
      imdbId: title?.imdbId ?? entry.imdbId,
      importedProgress: title?.progress ?? entry.importedProgress,
    };

    if (JSON.stringify(refreshed) === JSON.stringify(entry)) {
      return entry;
    }

    updated += 1;

    return refreshed;
  });

  return {
    shelf: { ...shelf, entries: [...existing, ...added] },
    added: added.length,
    updated,
  };
}
