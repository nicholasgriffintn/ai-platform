import z from "zod/v4";

import type { ShelfEntry } from "./shelf";
import { parseTitleId } from "./titles";

export const WATCHING_UPDATES_KIND = "watching.updates";
export const WATCHING_UPDATES_GROUP = "watching:updates";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WATCHING_TTL_MS = 24 * HOUR_MS;
const WATCHLIST_TTL_MS = 72 * HOUR_MS;
const PERSON_TTL_MS = 7 * DAY_MS;
const NEWS_VISIBLE_MS = 3 * DAY_MS;
const NEWS_RETAINED = 100;
const ANNOUNCED_RETAINED = 5000;
const SEASON_LOOKAHEAD_MS = 14 * DAY_MS;
const ACTIVE_STATUSES = new Set(["watching", "watchlist"]);

const nextEpisodeSchema = z.object({
  airDate: z.string(),
  airsAt: z.string().nullable(),
  season: z.number().int().nullable(),
  episode: z.number().int().nullable(),
  name: z.string(),
  network: z.string().nullable(),
});

const titleSnapshotSchema = z.object({
  titleId: z.string(),
  checkedAt: z.string(),
  nextEpisode: nextEpisodeSchema.nullable(),
  releaseDate: z.string().nullable(),
  streaming: z.array(z.string()),
});

const personSnapshotSchema = z.object({
  tmdbPersonId: z.number().int(),
  checkedAt: z.string(),
  creditIds: z.array(z.string()),
});

const newsSchema = z.object({
  key: z.string(),
  headline: z.string(),
  detail: z.string(),
  url: z.string(),
  createdAt: z.string(),
});

export const updatesContentSchema = z.object({
  titles: z.array(titleSnapshotSchema),
  people: z.array(personSnapshotSchema),
  news: z.array(newsSchema),
  announced: z.array(z.string()),
  trailersCheckedAt: z.string().nullable(),
});

export type UpdatesContent = z.infer<typeof updatesContentSchema>;
export type TitleSnapshot = z.infer<typeof titleSnapshotSchema>;
export type PersonSnapshot = z.infer<typeof personSnapshotSchema>;
export type NewsCandidate = Omit<z.infer<typeof newsSchema>, "createdAt">;

export function emptyUpdates(): UpdatesContent {
  return { titles: [], people: [], news: [], announced: [], trailersCheckedAt: null };
}

function age(checkedAt: string, now: Date): number {
  return now.getTime() - Date.parse(checkedAt);
}

function isTitleStale(entry: ShelfEntry, snapshot: TitleSnapshot | undefined, now: Date): boolean {
  if (!snapshot) {
    return true;
  }

  const today = now.toISOString().slice(0, 10);

  if (snapshot.nextEpisode && snapshot.nextEpisode.airDate < today) {
    return true;
  }

  return (
    age(snapshot.checkedAt, now) >
    (entry.status === "watching" ? WATCHING_TTL_MS : WATCHLIST_TTL_MS)
  );
}

export function selectStaleTitles(
  entries: readonly ShelfEntry[],
  updates: UpdatesContent,
  now: Date,
  limit: number,
): ShelfEntry[] {
  const snapshots = new Map(updates.titles.map((title) => [title.titleId, title]));
  const checkedAt = (entry: ShelfEntry) => snapshots.get(entry.titleId)?.checkedAt ?? "";

  return entries
    .filter((entry) => ACTIVE_STATUSES.has(entry.status))
    .filter((entry) => isTitleStale(entry, snapshots.get(entry.titleId), now))
    .sort((left, right) => checkedAt(left).localeCompare(checkedAt(right)))
    .slice(0, limit);
}

export function selectStalePeople<TPerson extends { tmdbPersonId: number }>(
  people: readonly TPerson[],
  updates: UpdatesContent,
  now: Date,
  limit: number,
): TPerson[] {
  const snapshots = new Map(updates.people.map((person) => [person.tmdbPersonId, person]));

  return people
    .filter((person) => {
      const snapshot = snapshots.get(person.tmdbPersonId);

      return !snapshot || age(snapshot.checkedAt, now) > PERSON_TTL_MS;
    })
    .slice(0, limit);
}

export function shouldCheckTrailers(updates: UpdatesContent, now: Date): boolean {
  return !updates.trailersCheckedAt || age(updates.trailersCheckedAt, now) > WATCHING_TTL_MS;
}

export function titleUrl(titleId: string): string {
  const ref = parseTitleId(titleId);

  return ref ? `https://www.themoviedb.org/${ref.mediaType}/${ref.tmdbId}` : "";
}

export function compareTitle(
  entry: ShelfEntry,
  previous: TitleSnapshot | undefined,
  next: TitleSnapshot,
  now: Date,
): NewsCandidate[] {
  const news: NewsCandidate[] = [];
  const url = titleUrl(entry.titleId);
  const episode = next.nextEpisode;
  const cutoff = new Date(now.getTime() + SEASON_LOOKAHEAD_MS).toISOString().slice(0, 10);

  if (episode?.episode === 1 && episode.airDate <= cutoff) {
    news.push({
      key: `season:${entry.titleId}:${episode.season}`,
      headline: `${entry.title} is back`,
      detail: `Season ${episode.season} starts on ${episode.airDate}.`,
      url,
    });
  }

  if (previous && entry.status === "watchlist") {
    for (const service of next.streaming.filter((name) => !previous.streaming.includes(name))) {
      news.push({
        key: `arrival:${entry.titleId}:${service}`,
        headline: `${entry.title} is on ${service}`,
        detail: `It is on your watchlist and just arrived on ${service}.`,
        url,
      });
    }
  }

  return news;
}

export function comparePerson(
  person: { tmdbPersonId: number; name: string },
  previous: PersonSnapshot | undefined,
  credits: readonly { id: string; title: string; year: number | null }[],
): NewsCandidate[] {
  if (!previous) {
    return [];
  }

  return credits
    .filter((credit) => !previous.creditIds.includes(credit.id))
    .map((credit) => ({
      key: `person:${person.tmdbPersonId}:${credit.id}`,
      headline: `${person.name} has something new`,
      detail: `${credit.title}${credit.year ? ` (${credit.year})` : ""}.`,
      url: titleUrl(credit.id),
    }));
}

export function recordNews(
  updates: UpdatesContent,
  candidates: readonly NewsCandidate[],
  now: Date,
): UpdatesContent {
  const announced = new Set(updates.announced);
  const fresh = candidates.filter((candidate) => {
    const isNew = !announced.has(candidate.key);

    announced.add(candidate.key);

    return isNew;
  });

  return {
    ...updates,
    announced: [...announced].slice(-ANNOUNCED_RETAINED),
    news: [
      ...updates.news,
      ...fresh.map((candidate) => ({ ...candidate, createdAt: now.toISOString() })),
    ].slice(-NEWS_RETAINED),
  };
}

export function listVisibleNews(updates: UpdatesContent, now: Date) {
  return updates.news.filter((item) => age(item.createdAt, now) <= NEWS_VISIBLE_MS);
}
