import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { EpisodeRef, SeasonSize } from "~/modules/watching/domain/episodes";
import {
  DEFAULT_REGION,
  formatTitleId,
  readReleaseYear,
  type MediaType,
  type TitleRef,
  type TitleSummary,
} from "~/modules/watching/domain/titles";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_TIMEOUT_MS = 10_000;
const OVERVIEW_LIMIT = 300;
const RECENT_TITLE_PAGES = [1, 2, 3];
const RECENT_TITLE_FEEDS: readonly { path: string; mediaType?: MediaType }[] = [
  { path: "/trending/all/day" },
  { path: "/movie/now_playing", mediaType: "movie" },
  { path: "/movie/upcoming", mediaType: "movie" },
  { path: "/tv/on_the_air", mediaType: "tv" },
];

export interface TmdbNamedId {
  id: number;
  name: string;
}

export interface TmdbDiscoverFilters {
  mediaType: MediaType;
  genreIds: number[];
  excludedGenreIds: number[];
  providerIds: number[];
  region: string;
  maxRuntime?: number;
  minScore?: number;
  releasedAfter?: string;
  maxCertification?: string;
}

async function requestTmdb(
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
  });

  if (response.status === 404) {
    await response.body?.cancel();
    throw new AssistantError("TMDB has no such record", ErrorType.NOT_FOUND, 404);
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `TMDB answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new AssistantError("TMDB returned an invalid payload", ErrorType.EXTERNAL_API_ERROR, 502);
  }

  return payload;
}

function readRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readSummary(
  entry: Record<string, unknown>,
  fallbackType?: MediaType,
): TitleSummary | null {
  const mediaType =
    entry.media_type === "movie" || entry.media_type === "tv" ? entry.media_type : fallbackType;

  if (!mediaType || typeof entry.id !== "number") {
    return null;
  }

  const score = typeof entry.vote_average === "number" ? entry.vote_average : 0;

  return {
    id: formatTitleId({ mediaType, tmdbId: entry.id }),
    title: readString(entry.title) || readString(entry.name),
    year: readReleaseYear(readString(entry.release_date) || readString(entry.first_air_date)),
    mediaType,
    overview: readString(entry.overview).slice(0, OVERVIEW_LIMIT),
    tmdbScore: score > 0 ? score : null,
  };
}

function readSummaries(value: unknown, fallbackType?: MediaType): TitleSummary[] {
  return readRecords(value).flatMap((entry) => readSummary(entry, fallbackType) ?? []);
}

function readNamedIds(value: unknown, idKey: string, nameKey: string): TmdbNamedId[] {
  return readRecords(value).flatMap((entry) => {
    const id = entry[idKey];
    const name = entry[nameKey];

    return typeof id === "number" && typeof name === "string" ? [{ id, name }] : [];
  });
}

function readProviderNames(details: Record<string, unknown>, region: string) {
  const providers = isRecord(details["watch/providers"]) ? details["watch/providers"] : {};
  const results = isRecord(providers.results) ? providers.results : {};
  const local = isRecord(results[region]) ? results[region] : {};
  const names = (key: string) =>
    readNamedIds(local[key], "provider_id", "provider_name").map((entry) => entry.name);

  return { streaming: names("flatrate"), rent: names("rent"), buy: names("buy") };
}

function readCertification(details: Record<string, unknown>, region: string): string | null {
  const contentRatings = isRecord(details.content_ratings) ? details.content_ratings : {};
  const tv = readRecords(contentRatings.results).find((entry) => entry.iso_3166_1 === region);

  if (tv) {
    return readString(tv.rating) || null;
  }

  const releases = isRecord(details.release_dates) ? details.release_dates : {};
  const movie = readRecords(releases.results).find((entry) => entry.iso_3166_1 === region);
  const dated = readRecords(movie?.release_dates).find((entry) => readString(entry.certification));

  return dated ? readString(dated.certification) : null;
}

function readImdbId(details: Record<string, unknown>): string | null {
  const external = isRecord(details.external_ids) ? details.external_ids : {};
  const imdbId = readString(external.imdb_id) || readString(details.imdb_id);

  return imdbId || null;
}

function readCredits(details: Record<string, unknown>) {
  const credits = isRecord(details.credits) ? details.credits : {};

  return {
    cast: readRecords(credits.cast)
      .slice(0, 8)
      .map((entry) => readString(entry.name)),
    directors: readRecords(credits.crew)
      .filter((entry) => entry.job === "Director")
      .map((entry) => readString(entry.name)),
  };
}

function readKeywords(details: Record<string, unknown>): string[] {
  const keywords = isRecord(details.keywords) ? details.keywords : {};

  return readNamedIds(keywords.keywords ?? keywords.results, "id", "name").map(
    (entry) => entry.name,
  );
}

function readSeasonSizes(details: Record<string, unknown>): SeasonSize[] {
  return readRecords(details.seasons).flatMap((entry) =>
    typeof entry.season_number === "number" && typeof entry.episode_count === "number"
      ? [{ season: entry.season_number, episodes: entry.episode_count }]
      : [],
  );
}

function readLastAired(details: Record<string, unknown>): EpisodeRef | null {
  const last = details.last_episode_to_air;

  return isRecord(last) &&
    typeof last.season_number === "number" &&
    typeof last.episode_number === "number"
    ? { season: last.season_number, episode: last.episode_number }
    : null;
}

function readNextEpisode(details: Record<string, unknown>) {
  const next = details.next_episode_to_air;

  if (!isRecord(next) || !readString(next.air_date)) {
    return null;
  }

  return {
    airDate: readString(next.air_date),
    season: typeof next.season_number === "number" ? next.season_number : null,
    episode: typeof next.episode_number === "number" ? next.episode_number : null,
    name: readString(next.name),
  };
}

export async function searchTmdbTitles(token: string, query: string, mediaType?: MediaType) {
  const path = mediaType ? `/search/${mediaType}` : "/search/multi";
  const payload = await requestTmdb(token, path, { query, include_adult: "false" });

  return readSummaries(payload.results, mediaType);
}

export async function fetchTmdbTitle(token: string, ref: TitleRef, region = DEFAULT_REGION) {
  const certifications = ref.mediaType === "tv" ? "content_ratings" : "release_dates";
  const details = await requestTmdb(token, `/${ref.mediaType}/${ref.tmdbId}`, {
    append_to_response: `external_ids,credits,keywords,watch/providers,${certifications}`,
  });
  const summary = readSummary(details, ref.mediaType);

  if (!summary) {
    throw new AssistantError("TMDB has no such record", ErrorType.NOT_FOUND, 404);
  }

  const runtime = typeof details.runtime === "number" ? details.runtime : null;

  return {
    ...summary,
    imdbId: readImdbId(details),
    genres: readNamedIds(details.genres, "id", "name").map((entry) => entry.name),
    runtimeMinutes: runtime && runtime > 0 ? runtime : null,
    certification: readCertification(details, region),
    releaseDate: readString(details.release_date) || null,
    status: readString(details.status) || null,
    seasons: typeof details.number_of_seasons === "number" ? details.number_of_seasons : null,
    nextEpisode: readNextEpisode(details),
    keywords: readKeywords(details),
    studios: readNamedIds(details.production_companies, "id", "name").map((entry) => entry.name),
    seasonSizes: readSeasonSizes(details),
    lastAired: readLastAired(details),
    services: readProviderNames(details, region),
    ...readCredits(details),
  };
}

export async function fetchTmdbImdbId(token: string, ref: TitleRef): Promise<string | null> {
  const payload = await requestTmdb(token, `/${ref.mediaType}/${ref.tmdbId}/external_ids`);

  return readString(payload.imdb_id) || null;
}

export async function findTmdbTitleByImdbId(token: string, imdbId: string) {
  const payload = await requestTmdb(token, `/find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  });

  return (
    readSummaries(payload.movie_results, "movie")[0] ??
    readSummaries(payload.tv_results, "tv")[0] ??
    null
  );
}

export async function fetchTmdbRecommendations(token: string, ref: TitleRef) {
  const payload = await requestTmdb(token, `/${ref.mediaType}/${ref.tmdbId}/recommendations`);

  return readSummaries(payload.results, ref.mediaType);
}

export async function searchTmdbPerson(token: string, name: string): Promise<TmdbNamedId | null> {
  const payload = await requestTmdb(token, "/search/person", { query: name });

  return readNamedIds(payload.results, "id", "name")[0] ?? null;
}

export async function fetchTmdbPersonCredits(token: string, personId: number) {
  const payload = await requestTmdb(token, `/person/${personId}/combined_credits`);
  const seen = new Set<string>();

  return readSummaries([
    ...readRecords(payload.cast),
    ...readRecords(payload.crew).filter((entry) => entry.job === "Director"),
  ])
    .filter((title) => {
      const isNew = !seen.has(title.id);

      seen.add(title.id);

      return isNew;
    })
    .sort((left, right) => (right.year ?? 0) - (left.year ?? 0));
}

export async function fetchTmdbRecentTitleIds(token: string): Promise<string[]> {
  const pages = await Promise.all(
    RECENT_TITLE_FEEDS.flatMap(({ path, mediaType }) =>
      RECENT_TITLE_PAGES.map(async (page) => {
        const payload = await requestTmdb(token, path, { page: String(page) });

        return readSummaries(payload.results, mediaType);
      }),
    ),
  );

  return [...new Set(pages.flat().map((title) => title.id))];
}

export async function fetchTmdbReleases(
  token: string,
  window: { from: string; until: string; region: string },
) {
  const [films, series] = await Promise.all([
    requestTmdb(token, "/discover/movie", {
      include_adult: "false",
      region: window.region,
      sort_by: "popularity.desc",
      with_release_type: "2|3",
      "primary_release_date.gte": window.from,
      "primary_release_date.lte": window.until,
    }),
    requestTmdb(token, "/discover/tv", {
      include_adult: "false",
      sort_by: "popularity.desc",
      "air_date.gte": window.from,
      "air_date.lte": window.until,
    }),
  ]);

  return {
    films: readSummaries(films.results, "movie"),
    series: readSummaries(series.results, "tv"),
  };
}

export async function fetchTmdbGenres(token: string, mediaType: MediaType) {
  const payload = await requestTmdb(token, `/genre/${mediaType}/list`);

  return readNamedIds(payload.genres, "id", "name");
}

export async function fetchTmdbProviders(token: string, mediaType: MediaType, region: string) {
  const payload = await requestTmdb(token, `/watch/providers/${mediaType}`, {
    watch_region: region,
  });

  return readNamedIds(payload.results, "provider_id", "provider_name");
}

export async function discoverTmdbTitles(token: string, filters: TmdbDiscoverFilters) {
  const dateField = filters.mediaType === "tv" ? "first_air_date.gte" : "primary_release_date.gte";
  const payload = await requestTmdb(token, `/discover/${filters.mediaType}`, {
    include_adult: "false",
    sort_by: "popularity.desc",
    "vote_count.gte": "50",
    ...(filters.genreIds.length ? { with_genres: filters.genreIds.join(",") } : {}),
    ...(filters.excludedGenreIds.length
      ? { without_genres: filters.excludedGenreIds.join(",") }
      : {}),
    ...(filters.providerIds.length
      ? {
          with_watch_providers: filters.providerIds.join("|"),
          watch_region: filters.region,
          with_watch_monetization_types: "flatrate",
        }
      : {}),
    ...(filters.maxRuntime ? { "with_runtime.lte": String(filters.maxRuntime) } : {}),
    ...(filters.minScore ? { "vote_average.gte": String(filters.minScore) } : {}),
    ...(filters.releasedAfter ? { [dateField]: filters.releasedAfter } : {}),
    ...(filters.maxCertification && filters.mediaType === "movie"
      ? { certification_country: filters.region, "certification.lte": filters.maxCertification }
      : {}),
  });

  return readSummaries(payload.results, filters.mediaType);
}
