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

const TRAKT_PAGE_SIZE = 1000;

export interface TraktSyncItem {
  mediaType: MediaType;
  tmdbId: number;
  rating?: number;
  episodes?: readonly TmdbEpisodeRef[];
}

export interface TraktLibraryTitle {
  titleId: string;
  mediaType: MediaType;
  title: string;
  year: number | null;
  rating: number | null;
  episodes: TmdbEpisodeRef[];
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
  const tmdbId = readFiniteNumber(readMediaIds(media).tmdb);
  const title = isRecord(media) ? readNonEmptyString(media.title) : undefined;

  return isRecord(media) && tmdbId && title
    ? {
        titleId: formatTitleId({ mediaType, tmdbId }),
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

function readLibraryTitles(
  entries: readonly unknown[],
  mediaType: MediaType,
  extras: (entry: unknown) => Pick<TraktLibraryTitle, "rating" | "episodes">,
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
  const read = async (path: string) =>
    readArray(await readTrakt(clientId, accessToken, `${path}?limit=${TRAKT_PAGE_SIZE}`));
  const [movies, shows, movieRatings, showRatings, movieList, showList] = await Promise.all([
    read("/sync/watched/movies"),
    read("/sync/watched/shows"),
    read("/sync/ratings/movies"),
    read("/sync/ratings/shows"),
    read("/sync/watchlist/movies"),
    read("/sync/watchlist/shows"),
  ]);
  const plain = () => ({ rating: null, episodes: [] });
  const rated = (entry: unknown) => ({
    rating: isRecord(entry) ? (readFiniteNumber(entry.rating) ?? null) : null,
    episodes: [],
  });

  return {
    watched: [
      ...readLibraryTitles(movies, "movie", plain),
      ...readLibraryTitles(shows, "tv", (entry) => ({
        rating: null,
        episodes: readWatchedEpisodes(entry),
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
  const played = new Set(
    readWatchedEpisodes(progress, (episode) => episode.completed === true).map(episodeKey),
  );
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
