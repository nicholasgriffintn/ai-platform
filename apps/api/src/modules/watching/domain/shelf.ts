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

const entrySchema = z.object({
  titleId: z.string(),
  mediaType: z.enum(MEDIA_TYPES),
  title: z.string(),
  year: z.number().int().nullable(),
  status: z.enum(VIEWING_STATUSES),
  rating: z.number().int().nullable(),
  thoughts: z.string().nullable(),
  updatedAt: z.string(),
  episodes: z.array(episodeSchema),
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

export function emptyShelf(): ShelfContent {
  return { entries: [], following: [] };
}

export function findShelfEntry(shelf: ShelfContent, titleId: string): ShelfEntry | undefined {
  return shelf.entries.find((entry) => entry.titleId === titleId);
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
    mediaType: change.mediaType,
    title: change.title,
    year: change.year,
    status: change.status,
    rating: change.rating ?? current?.rating ?? null,
    thoughts: change.thoughts ?? current?.thoughts ?? null,
    updatedAt: new Date().toISOString(),
    episodes: current?.episodes ?? [],
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
