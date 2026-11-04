import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  classifyOmdbAnswer,
  readOmdbEpisodes,
  readOmdbSearch,
  readOmdbTitle,
} from "~/modules/watching/domain/omdb";
import type { MediaType } from "~/modules/watching/domain/titles";

const OMDB_URL = "https://www.omdbapi.com/";
const OMDB_TIMEOUT_MS = 10_000;

async function requestOmdb(
  apiKey: string,
  params: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const url = new URL(OMDB_URL);

  url.search = new URLSearchParams({ apikey: apiKey, ...params }).toString();

  const response = await fetch(url, { signal: AbortSignal.timeout(OMDB_TIMEOUT_MS) });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `OMDb answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const answer = classifyOmdbAnswer(await response.json());

  if (answer.kind === "limited") {
    throw new AssistantError("OMDb request limit reached", ErrorType.RATE_LIMIT_ERROR, 429);
  }

  if (answer.kind === "failed") {
    throw new AssistantError(answer.message, ErrorType.EXTERNAL_API_ERROR, 502);
  }

  return answer.kind === "found" ? answer.payload : null;
}

function omdbType(mediaType: MediaType | undefined): Record<string, string> {
  return mediaType ? { type: mediaType === "tv" ? "series" : "movie" } : {};
}

export async function fetchOmdbTitle(apiKey: string, imdbId: string) {
  const payload = await requestOmdb(apiKey, { i: imdbId, plot: "full" });

  return payload ? readOmdbTitle(payload) : null;
}

export async function fetchOmdbSeason(apiKey: string, imdbId: string, season: number) {
  const payload = await requestOmdb(apiKey, { i: imdbId, Season: String(season) });

  return payload ? readOmdbEpisodes(payload) : [];
}

export async function searchOmdb(apiKey: string, query: string, mediaType?: MediaType) {
  const payload = await requestOmdb(apiKey, { s: query.slice(0, 120), ...omdbType(mediaType) });

  return payload ? readOmdbSearch(payload) : [];
}
