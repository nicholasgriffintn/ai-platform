import {
  fetchTmdbPersonCredits,
  fetchTmdbReleases,
  fetchTmdbTitle,
  fetchTvmazeNextEpisode,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  listRecentEntries,
  type ShelfContent,
  type ShelfEntry,
} from "~/modules/watching/domain/shelf";
import { DEFAULT_REGION, parseTitleId } from "~/modules/watching/domain/titles";
import {
  compareTitle,
  comparePerson,
  emptyUpdates,
  listVisibleNews,
  recordNews,
  selectStalePeople,
  selectStaleTitles,
  shouldCheckTrailers,
  updatesContentSchema,
  WATCHING_UPDATES_GROUP,
  WATCHING_UPDATES_KIND,
  type NewsCandidate,
  type PersonSnapshot,
  type TitleSnapshot,
  type UpdatesContent,
} from "~/modules/watching/domain/updates";
import { fetchTrailers } from "~/modules/watching/infrastructure/kinocheck-client";

import { requireTmdbToken } from "./catalogue";
import {
  readWatchingDocument,
  updateWatchingDocument,
  type WatchingDocument,
} from "./document-store";
import { readShelfContent } from "./shelf-store";

const logger = getLogger({ prefix: "watching/updates" });
const TITLE_REFRESH_BUDGET = 25;
const PERSON_REFRESH_BUDGET = 10;
const REFRESH_CONCURRENCY = 4;
const CLOCK_TIME_LOOKAHEAD_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;
const RELEASE_LIMIT = 8;

const UPDATES_DOCUMENT: WatchingDocument<UpdatesContent> = {
  kind: WATCHING_UPDATES_KIND,
  group: WATCHING_UPDATES_GROUP,
  title: "Film and TV updates",
  idPrefix: "watching_updates",
  schema: updatesContentSchema,
  empty: emptyUpdates,
};

const refreshes = new WeakMap<ServiceContext, Promise<RefreshedState>>();

interface RefreshedState {
  shelf: ShelfContent;
  updates: UpdatesContent;
}

export interface WeekAheadEntry {
  kind: "episode" | "release";
  titleId: string;
  title: string;
  when: string;
  season?: number | null;
  episode?: number | null;
  name?: string;
  network?: string;
}

async function checkTitle(
  token: string,
  entry: ShelfEntry,
  now: Date,
): Promise<TitleSnapshot | null> {
  const ref = parseTitleId(entry.titleId);

  if (!ref) {
    return null;
  }

  const details = await fetchTmdbTitle(token, ref);
  const next = details.nextEpisode;
  const soon = new Date(now.getTime() + CLOCK_TIME_LOOKAHEAD_MS).toISOString().slice(0, 10);
  const timed =
    next && next.airDate <= soon && details.imdbId
      ? await fetchTvmazeNextEpisode(details.imdbId).catch(() => null)
      : null;
  const matches = timed?.season === next?.season && timed?.episode === next?.episode;

  return {
    titleId: entry.titleId,
    checkedAt: now.toISOString(),
    nextEpisode: next
      ? {
          ...next,
          airsAt: matches && timed ? timed.airsAt : null,
          network: matches && timed ? timed.network : null,
        }
      : null,
    releaseDate: details.releaseDate,
    streaming: details.services.streaming,
  };
}

async function checkTitles(
  token: string,
  entries: readonly ShelfEntry[],
  now: Date,
): Promise<{ entry: ShelfEntry; snapshot: TitleSnapshot }[]> {
  const checked = await mapWithConcurrency(entries, REFRESH_CONCURRENCY, async (entry) => {
    try {
      const snapshot = await checkTitle(token, entry, now);

      return snapshot ? [{ entry, snapshot }] : [];
    } catch (error) {
      logger.warn("Could not refresh a shelf title", {
        title_id: entry.titleId,
        error_message: getErrorMessage(error),
      });

      return [];
    }
  });

  return checked.flat();
}

async function checkPeople(token: string, people: ShelfContent["following"], now: Date) {
  const checked = await mapWithConcurrency(people, REFRESH_CONCURRENCY, async (person) => {
    const credits = await fetchTmdbPersonCredits(token, person.tmdbPersonId).catch(() => null);

    return credits ? [{ person, credits, checkedAt: now.toISOString() }] : [];
  });

  return checked.flat();
}

function replaceSnapshots<TSnapshot>(
  current: readonly TSnapshot[],
  next: readonly TSnapshot[],
  readKey: (snapshot: TSnapshot) => string | number,
  keep: ReadonlySet<string | number>,
): TSnapshot[] {
  const replaced = new Set(next.map(readKey));

  return [
    ...current.filter(
      (snapshot) => keep.has(readKey(snapshot)) && !replaced.has(readKey(snapshot)),
    ),
    ...next,
  ];
}

async function runRefresh(context: ServiceContext): Promise<RefreshedState> {
  const now = new Date();
  const [shelf, updates] = await Promise.all([
    readShelfContent(context),
    readWatchingDocument(context, UPDATES_DOCUMENT),
  ]);
  const staleTitles = selectStaleTitles(shelf.entries, updates, now, TITLE_REFRESH_BUDGET);
  const stalePeople = selectStalePeople(shelf.following, updates, now, PERSON_REFRESH_BUDGET);
  const wantsTrailers = shelf.entries.length > 0 && shouldCheckTrailers(updates, now);

  if (staleTitles.length === 0 && stalePeople.length === 0 && !wantsTrailers) {
    return { shelf, updates };
  }

  const token = requireTmdbToken(context);
  const [titles, people, trailers] = await Promise.all([
    checkTitles(token, staleTitles, now),
    checkPeople(token, stalePeople, now),
    wantsTrailers ? fetchTrailers(context.env.KINOCHECK_API_KEY, "latest").catch(() => null) : null,
  ]);
  const onShelf = new Map(shelf.entries.map((entry) => [entry.titleId, entry.title]));
  const saved = await updateWatchingDocument(context, UPDATES_DOCUMENT, (content) => {
    const snapshots = new Map(content.titles.map((title) => [title.titleId, title]));
    const known = new Map(content.people.map((person) => [person.tmdbPersonId, person]));
    const candidates: NewsCandidate[] = [
      ...titles.flatMap(({ entry, snapshot }) =>
        compareTitle(entry, snapshots.get(entry.titleId), snapshot, now),
      ),
      ...people.flatMap(({ person, credits }) =>
        comparePerson(person, known.get(person.tmdbPersonId), credits),
      ),
      ...(trailers ?? []).flatMap((trailer) => {
        const title = onShelf.get(trailer.titleId);

        return title
          ? [
              {
                key: `trailer:${trailer.url}`,
                headline: `New trailer for ${title}`,
                detail: trailer.name,
                url: trailer.url,
              },
            ]
          : [];
      }),
    ];
    const personSnapshots: PersonSnapshot[] = people.map(({ person, credits, checkedAt }) => ({
      tmdbPersonId: person.tmdbPersonId,
      checkedAt,
      creditIds: credits.map((credit) => credit.id),
    }));

    return recordNews(
      {
        ...content,
        titles: replaceSnapshots(
          content.titles,
          titles.map(({ snapshot }) => snapshot),
          (snapshot) => snapshot.titleId,
          new Set(shelf.entries.map((entry) => entry.titleId)),
        ),
        people: replaceSnapshots(
          content.people,
          personSnapshots,
          (snapshot) => snapshot.tmdbPersonId,
          new Set(shelf.following.map((person) => person.tmdbPersonId)),
        ),
        trailersCheckedAt: trailers ? now.toISOString() : content.trailersCheckedAt,
      },
      candidates,
      now,
    );
  });

  return { shelf, updates: saved };
}

function refreshOnce(context: ServiceContext): Promise<RefreshedState> {
  const running = refreshes.get(context) ?? runRefresh(context);

  refreshes.set(context, running);

  return running;
}

function readUpcomingEntry(
  entry: ShelfEntry,
  snapshot: TitleSnapshot,
  today: string,
  until: string,
): WeekAheadEntry[] {
  const next = snapshot.nextEpisode;

  if (next && next.airDate >= today && next.airDate <= until) {
    return [
      {
        kind: "episode",
        titleId: entry.titleId,
        title: entry.title,
        when: next.airsAt ?? next.airDate,
        season: next.season,
        episode: next.episode,
        name: next.name,
        ...(next.network ? { network: next.network } : {}),
      },
    ];
  }

  const release = snapshot.releaseDate;

  return entry.mediaType === "movie" && release && release >= today && release <= until
    ? [{ kind: "release", titleId: entry.titleId, title: entry.title, when: release }]
    : [];
}

export async function readWeekAhead(context: ServiceContext, days: number) {
  const { shelf, updates } = await refreshOnce(context);
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
  const snapshots = new Map(updates.titles.map((title) => [title.titleId, title]));
  const entries = listRecentEntries(shelf, ["watching", "watchlist"]).flatMap((entry) => {
    const snapshot = snapshots.get(entry.titleId);

    return snapshot ? readUpcomingEntry(entry, snapshot, today, until) : [];
  });

  return { days, entries: entries.sort((left, right) => left.when.localeCompare(right.when)) };
}

export async function readReleases(context: ServiceContext, days: number, region = DEFAULT_REGION) {
  if (!context.env.TMDB_API_TOKEN) {
    return { films: [], series: [] };
  }

  const releases = await fetchTmdbReleases(requireTmdbToken(context), {
    from: new Date().toISOString().slice(0, 10),
    until: new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10),
    region,
  });

  return {
    films: releases.films.slice(0, RELEASE_LIMIT),
    series: releases.series.slice(0, RELEASE_LIMIT),
  };
}

export async function readWatchingNews(context: ServiceContext) {
  const { updates } = await refreshOnce(context);

  return { news: listVisibleNews(updates, new Date()) };
}
