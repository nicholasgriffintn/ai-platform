import {
  discoverTmdbTitles,
  fetchMalScores,
  fetchOmdbSeason,
  fetchOmdbTitle,
  fetchTmdbGenres,
  fetchTmdbImdbId,
  fetchTmdbPersonCredits,
  fetchTmdbProviders,
  fetchTmdbRecommendations,
  fetchTmdbTitle,
  findTmdbTitleByImdbId,
  type OmdbTitle,
  searchAniList,
  searchOmdb,
  searchTmdbPerson,
  searchTmdbTitles,
  type TmdbNamedId,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  DEFAULT_REGION,
  parseTitleId,
  stripMediaWords,
  type MediaType,
  type TitleRef,
  type TitleSummary,
} from "~/modules/watching/domain/titles";

export const SCORED_TITLE_LIMIT = 12;

const logger = getLogger({ prefix: "watching/catalogue" });
const SCORING_CONCURRENCY = 6;
const FALLBACK_SEARCH_LIMIT = 5;

export interface DiscoverTitlesInput {
  mediaType: MediaType;
  genres?: string[];
  excludedGenres?: string[];
  services?: string[];
  maxRuntime?: number;
  minScore?: number;
  minImdbRating?: number;
  releasedAfter?: string;
  maxCertification?: string;
  region?: string;
  limit: number;
}

export async function searchAnime(context: ServiceContext, query: string, limit: number) {
  const matches = await searchAniList(query, limit);
  const clientId = context.env.MAL_CLIENT_ID;

  if (!clientId) {
    return matches;
  }

  return mapWithConcurrency(matches, SCORING_CONCURRENCY, async (anime) => {
    const scores = anime.malId
      ? await fetchMalScores(clientId, anime.malId).catch(() => null)
      : null;

    return scores ? { ...anime, ...scores } : anime;
  });
}

export function requireTmdbToken(context: Pick<ServiceContext, "env">): string {
  const token = context.env.TMDB_API_TOKEN;

  if (!token) {
    throw new AssistantError("TMDB is not configured", ErrorType.CONFIGURATION_ERROR, 503);
  }

  return token;
}

export function requireTitleRef(titleId: string): TitleRef {
  const ref = parseTitleId(titleId);

  if (!ref) {
    throw new AssistantError(
      "titleId must look like movie:550 or tv:1399",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return ref;
}

async function readOmdbForTitle(
  apiKey: string | undefined,
  imdbId: string | null,
): Promise<OmdbTitle | null> {
  if (!apiKey || !imdbId) {
    return null;
  }

  return fetchOmdbTitle(apiKey, imdbId).catch((error: unknown) => {
    logger.warn("OMDb lookup failed", { error_message: getErrorMessage(error) });

    return null;
  });
}

export async function withScores(
  context: ServiceContext,
  titles: readonly TitleSummary[],
): Promise<TitleSummary[]> {
  const apiKey = context.env.OMDB_API_KEY;

  if (!apiKey) {
    return [...titles];
  }

  const token = requireTmdbToken(context);
  const scored = await mapWithConcurrency(
    titles.slice(0, SCORED_TITLE_LIMIT),
    SCORING_CONCURRENCY,
    async (title) => {
      const ref = parseTitleId(title.id);
      const imdbId = ref ? await fetchTmdbImdbId(token, ref).catch(() => null) : null;
      const omdb = await readOmdbForTitle(apiKey, imdbId);

      return omdb
        ? {
            ...title,
            imdbRating: omdb.imdbRating,
            imdbVotes: omdb.imdbVotes,
            rottenTomatoes: omdb.rottenTomatoes,
            metascore: omdb.metascore,
          }
        : title;
    },
  );

  return [...scored, ...titles.slice(SCORED_TITLE_LIMIT)];
}

async function searchThroughOmdb(context: ServiceContext, query: string, mediaType?: MediaType) {
  const apiKey = context.env.OMDB_API_KEY;

  if (!apiKey) {
    return [];
  }

  const token = requireTmdbToken(context);
  const matches = await searchOmdb(apiKey, query, mediaType);
  const found = await mapWithConcurrency(
    matches.slice(0, FALLBACK_SEARCH_LIMIT),
    SCORING_CONCURRENCY,
    (match) => findTmdbTitleByImdbId(token, match.imdbId).catch(() => null),
  );

  return found.filter((title) => title !== null);
}

export async function searchTitles(
  context: ServiceContext,
  input: { query: string; mediaType?: MediaType; limit: number },
) {
  const token = requireTmdbToken(context);
  const stripped = stripMediaWords(input.query);
  const exact = await searchTmdbTitles(token, input.query, input.mediaType);
  const matches =
    exact.length > 0 || !stripped || stripped === input.query
      ? exact
      : await searchTmdbTitles(token, stripped, input.mediaType);
  const titles = matches.length
    ? matches
    : await searchThroughOmdb(context, stripped || input.query, input.mediaType);

  return withScores(context, titles.slice(0, input.limit));
}

function resolveNames(
  names: readonly string[] | undefined,
  known: readonly TmdbNamedId[],
  label: string,
): number[] {
  return (names ?? []).map((name) => {
    const lower = name.trim().toLowerCase();
    const match =
      known.find((entry) => entry.name.toLowerCase() === lower) ??
      known.find((entry) => entry.name.toLowerCase().includes(lower));

    if (!match) {
      throw new AssistantError(`Unknown ${label}: ${name}`, ErrorType.PARAMS_ERROR, 400);
    }

    return match.id;
  });
}

export async function discoverTitles(context: ServiceContext, input: DiscoverTitlesInput) {
  const token = requireTmdbToken(context);
  const region = input.region ?? DEFAULT_REGION;
  const wantsGenres = Boolean(input.genres?.length || input.excludedGenres?.length);
  const [genres, providers] = await Promise.all([
    wantsGenres ? fetchTmdbGenres(token, input.mediaType) : [],
    input.services?.length ? fetchTmdbProviders(token, input.mediaType, region) : [],
  ]);
  const matches = await discoverTmdbTitles(token, {
    mediaType: input.mediaType,
    genreIds: resolveNames(input.genres, genres, "genre"),
    excludedGenreIds: resolveNames(input.excludedGenres, genres, "genre"),
    providerIds: resolveNames(input.services, providers, "service"),
    region,
    maxRuntime: input.maxRuntime,
    minScore: input.minScore,
    releasedAfter: input.releasedAfter,
    maxCertification: input.maxCertification,
  });
  const scored = await withScores(context, matches);
  const minimum = input.minImdbRating;
  const kept = minimum
    ? scored.filter((title) => title.imdbRating != null && title.imdbRating >= minimum)
    : scored;

  return kept.slice(0, input.limit);
}

export async function getTitle(context: ServiceContext, titleId: string, region?: string) {
  const token = requireTmdbToken(context);
  const details = await fetchTmdbTitle(token, requireTitleRef(titleId), region);
  const omdb = await readOmdbForTitle(context.env.OMDB_API_KEY, details.imdbId);

  return {
    ...details,
    overview: omdb?.plot ?? details.overview,
    certification: details.certification ?? omdb?.certification ?? null,
    runtimeMinutes: details.runtimeMinutes ?? omdb?.runtimeMinutes ?? null,
    directors: details.directors.length ? details.directors : (omdb?.directors ?? []),
    writers: omdb?.writers ?? [],
    imdbRating: omdb?.imdbRating ?? null,
    imdbVotes: omdb?.imdbVotes ?? null,
    rottenTomatoes: omdb?.rottenTomatoes ?? null,
    metascore: omdb?.metascore ?? null,
    awards: omdb?.awards ?? null,
    boxOffice: omdb?.boxOffice ?? null,
  };
}

export async function getSeasonRatings(context: ServiceContext, titleId: string, season: number) {
  const apiKey = context.env.OMDB_API_KEY;

  if (!apiKey) {
    throw new AssistantError("OMDb is not configured", ErrorType.CONFIGURATION_ERROR, 503);
  }

  const ref = requireTitleRef(titleId);

  if (ref.mediaType !== "tv") {
    throw new AssistantError("Only series have seasons", ErrorType.PARAMS_ERROR, 400);
  }

  const imdbId = await fetchTmdbImdbId(requireTmdbToken(context), ref);

  if (!imdbId) {
    throw new AssistantError("IMDb has no record of this series", ErrorType.NOT_FOUND, 404);
  }

  return fetchOmdbSeason(apiKey, imdbId, season);
}

export async function findSimilarTitles(context: ServiceContext, titleId: string, limit: number) {
  const matches = await fetchTmdbRecommendations(
    requireTmdbToken(context),
    requireTitleRef(titleId),
  );

  return withScores(context, matches.slice(0, limit));
}

export async function titlesByPerson(context: ServiceContext, name: string, limit: number) {
  const token = requireTmdbToken(context);
  const person = await searchTmdbPerson(token, name);

  if (!person) {
    return { person: null, results: [] };
  }

  const credits = await fetchTmdbPersonCredits(token, person.id);

  return { person, results: await withScores(context, credits.slice(0, limit)) };
}
