import {
  isRecord,
  readArray,
  readFiniteNumber,
  readNonEmptyString,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { fetchJson } from "@ngriffin_uk/polychat-utility-server/http";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";
import { formatTitleId, type MediaType, type TmdbEpisodeRef } from "./tmdb.js";

const TRAKT_API_BASE_URL = "https://api.trakt.tv";
const fetchTraktJson = createConnectorJsonClient(TRAKT_API_BASE_URL);
const TRAKT_MEDIA_TYPES = new Set(["movies", "shows"]);

export const TRAKT_CREDENTIAL_SEPARATOR = "|";

function readTraktCredential(credential: string): { clientId: string; username?: string } {
  const separator = credential.indexOf(TRAKT_CREDENTIAL_SEPARATOR);

  if (separator === -1) {
    return { clientId: credential };
  }

  const username = credential.slice(separator + 1).trim();

  return { clientId: credential.slice(0, separator), ...(username ? { username } : {}) };
}

function requireTraktUser(params: Record<string, unknown>, fallback: string | undefined): string {
  const username = getStringParam(params, "username") ?? fallback;

  if (!username) {
    throw new AssistantError("username is required", ErrorType.PARAMS_ERROR, 400);
  }

  return encodeURIComponent(username);
}

function requireMediaType(params: Record<string, unknown>): string {
  const type = getStringParam(params, "type") ?? "movies";

  if (!TRAKT_MEDIA_TYPES.has(type)) {
    throw new AssistantError("type must be movies or shows", ErrorType.PARAMS_ERROR, 400);
  }

  return type;
}

export async function executeTraktOperation(
  credential: string,
  operation: string,
  params: Record<string, unknown>,
  options: { oauthClientId?: string } = {},
) {
  const oauthClientId = options.oauthClientId;
  const { clientId, username } = oauthClientId
    ? { clientId: oauthClientId, username: "me" }
    : readTraktCredential(credential);
  const headers = {
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
    Authorization: oauthClientId ? `Bearer ${credential}` : "",
  };
  const limit = limitPositiveInteger(getNumberParam(params, "limit"), 20, 100);

  if (operation === "get_history") {
    return fetchTraktJson({
      path: `/users/${requireTraktUser(params, username)}/history/${requireMediaType(params)}?limit=${limit}`,
      token: clientId,
      headers,
    });
  }

  if (operation === "get_watchlist") {
    return fetchTraktJson({
      path: `/users/${requireTraktUser(params, username)}/watchlist/${requireMediaType(params)}?limit=${limit}`,
      token: clientId,
      headers,
    });
  }

  throw new AssistantError("Unsupported Trakt operation", ErrorType.PARAMS_ERROR, 400);
}

const TRAKT_PAGE_SIZE = 250;
const TRAKT_MAX_PAGES = 100;

export interface TraktSyncItem {
  mediaType: MediaType;
  tmdbId: number;
  rating?: number;
  episodes?: readonly TmdbEpisodeRef[];
}

export interface TraktShowProgress {
  seasons: { season: number; watched: number }[];
  watched: number;
  unwatched: number | null;
}

export interface TraktLibraryTitle {
  titleId: string;
  imdbId: string | null;
  mediaType: MediaType;
  title: string;
  year: number | null;
  rating: number | null;
  progress: TraktShowProgress | null;
}

export interface TraktLibrary {
  watched: TraktLibraryTitle[];
  ratings: TraktLibraryTitle[];
  watchlist: TraktLibraryTitle[];
}

function traktHeaders(clientId: string, accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "Polychat",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
  };
}

function readTrakt(clientId: string, accessToken: string, path: string) {
  return fetchJson(`${TRAKT_API_BASE_URL}${path}`, {
    service: "Trakt",
    headers: traktHeaders(clientId, accessToken),
  });
}

function readMedia(entry: unknown, mediaType: MediaType) {
  return isRecord(entry) ? entry[mediaType === "tv" ? "show" : "movie"] : null;
}

function readMediaIds(media: unknown) {
  return isRecord(media) && isRecord(media.ids) ? media.ids : {};
}

function readLibraryTitle(entry: unknown, mediaType: MediaType) {
  const media = readMedia(entry, mediaType);
  const ids = readMediaIds(media);
  const tmdbId = readFiniteNumber(ids.tmdb);
  const title = isRecord(media) ? readNonEmptyString(media.title) : undefined;

  return isRecord(media) && tmdbId && title
    ? {
        titleId: formatTitleId({ mediaType, tmdbId }),
        imdbId: readNonEmptyString(ids.imdb) ?? null,
        mediaType,
        title,
        year: readFiniteNumber(media.year) ?? null,
      }
    : null;
}

function readWatchedEpisodes(
  entry: unknown,
  include: (episode: Record<string, unknown>) => boolean = () => true,
): TmdbEpisodeRef[] {
  const seasons = isRecord(entry) ? readArray(entry.seasons).filter(isRecord) : [];

  return seasons.flatMap((season) => {
    const number = readFiniteNumber(season.number);

    return number === undefined
      ? []
      : readArray(season.episodes)
          .filter(isRecord)
          .filter(include)
          .flatMap((episode) => {
            const value = readFiniteNumber(episode.number);

            return value === undefined ? [] : [{ season: number, episode: value }];
          });
  });
}

function isCompletedEpisode(episode: Record<string, unknown>): boolean {
  return episode.completed === true;
}

function readShowProgress(entry: unknown): TraktShowProgress {
  const counts = new Map<number, number>();

  for (const { season } of readWatchedEpisodes(entry)) {
    if (season > 0) {
      counts.set(season, (counts.get(season) ?? 0) + 1);
    }
  }

  const seasons = [...counts].map(([season, watched]) => ({ season, watched }));
  const watched = seasons.reduce((total, season) => total + season.watched, 0);
  const media = readMedia(entry, "tv");
  const aired = isRecord(media) ? readFiniteNumber(media.aired_episodes) : undefined;

  return {
    seasons,
    watched,
    unwatched: aired === undefined ? null : Math.max(0, aired - watched),
  };
}

async function readTraktList(
  clientId: string,
  accessToken: string,
  path: string,
  extended?: string,
): Promise<unknown[]> {
  const entries: unknown[] = [];

  for (let page = 1; page <= TRAKT_MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      ...(extended ? { extended } : {}),
      limit: String(TRAKT_PAGE_SIZE),
      page: String(page),
    });
    const items = readArray(await readTrakt(clientId, accessToken, `${path}?${query}`));

    if (items.length === 0) {
      return entries;
    }

    entries.push(...items);
  }

  throw new AssistantError(
    "This Trakt library is too large to import",
    ErrorType.EXTERNAL_API_ERROR,
    502,
  );
}

function readLibraryTitles(
  entries: readonly unknown[],
  mediaType: MediaType,
  extras: (entry: unknown) => Pick<TraktLibraryTitle, "rating" | "progress">,
): TraktLibraryTitle[] {
  return entries.flatMap((entry) => {
    const media = readLibraryTitle(entry, mediaType);

    return media ? [{ ...media, ...extras(entry) }] : [];
  });
}

export async function fetchTraktLibrary(
  clientId: string,
  accessToken: string,
): Promise<TraktLibrary> {
  const read = (list: string, extended?: string) =>
    readTraktList(clientId, accessToken, `/users/me/${list}`, extended);
  const [movies, shows, movieRatings, showRatings, movieList, showList] = await Promise.all([
    read("watched/movies"),
    read("watched/shows", "progress"),
    read("ratings/movies"),
    read("ratings/shows"),
    read("watchlist/movies"),
    read("watchlist/shows"),
  ]);
  const plain = () => ({ rating: null, progress: null });
  const rated = (entry: unknown) => ({
    rating: isRecord(entry) ? (readFiniteNumber(entry.rating) ?? null) : null,
    progress: null,
  });

  return {
    watched: [
      ...readLibraryTitles(movies, "movie", plain),
      ...readLibraryTitles(shows, "tv", (entry) => ({
        rating: null,
        progress: readShowProgress(entry),
      })),
    ],
    ratings: [
      ...readLibraryTitles(movieRatings, "movie", rated),
      ...readLibraryTitles(showRatings, "tv", rated),
    ],
    watchlist: [
      ...readLibraryTitles(movieList, "movie", plain),
      ...readLibraryTitles(showList, "tv", plain),
    ],
  };
}

function toSyncShow(item: TraktSyncItem) {
  const seasons = new Map<number, { number: number }[]>();

  for (const entry of item.episodes ?? []) {
    seasons.set(entry.season, [...(seasons.get(entry.season) ?? []), { number: entry.episode }]);
  }

  return {
    ids: { tmdb: item.tmdbId },
    ...(item.rating ? { rating: item.rating } : {}),
    ...(seasons.size > 0
      ? { seasons: [...seasons].map(([number, episodes]) => ({ number, episodes })) }
      : {}),
  };
}

export async function selectUnplayedOnTrakt(
  clientId: string,
  accessToken: string,
  item: TraktSyncItem,
): Promise<TraktSyncItem | null> {
  const type = item.mediaType === "tv" ? "show" : "movie";
  const [match] = readArray(
    await readTrakt(clientId, accessToken, `/search/tmdb/${item.tmdbId}?type=${type}`),
  );
  const traktId = readFiniteNumber(readMediaIds(readMedia(match, item.mediaType)).trakt);

  if (traktId === undefined) {
    return null;
  }

  if (item.mediaType === "movie") {
    const plays = readArray(
      await readTrakt(clientId, accessToken, `/sync/history/movies/${traktId}?limit=1`),
    );

    return plays.length > 0 ? null : item;
  }

  const progress = await readTrakt(
    clientId,
    accessToken,
    `/shows/${traktId}/progress/watched?hidden=true`,
  );
  const episodeKey = (entry: TmdbEpisodeRef) => `${entry.season}:${entry.episode}`;
  const played = new Set(readWatchedEpisodes(progress, isCompletedEpisode).map(episodeKey));
  const episodes = (item.episodes ?? readWatchedEpisodes(progress)).filter(
    (entry) => !played.has(episodeKey(entry)),
  );

  return episodes.length > 0 ? { ...item, episodes } : null;
}

export async function sendTraktSync(
  clientId: string,
  accessToken: string,
  path: string,
  items: readonly TraktSyncItem[],
): Promise<void> {
  await fetchJson(`${TRAKT_API_BASE_URL}${path}`, {
    service: "Trakt",
    headers: traktHeaders(clientId, accessToken),
    body: {
      movies: items.filter((item) => item.mediaType === "movie").map(toSyncShow),
      shows: items.filter((item) => item.mediaType === "tv").map(toSyncShow),
    },
  });
}
