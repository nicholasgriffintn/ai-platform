import { isRecord, readFiniteNumber, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { formatTitleId } from "~/modules/watching/domain/titles";

const KINOCHECK_BASE_URL = "https://api.kinocheck.com";
const KINOCHECK_TIMEOUT_MS = 12_000;
const KINOCHECK_PAGE_SIZE = "50";

export type TrailerFeed = "latest" | "trending";

export interface Trailer {
  titleId: string;
  name: string;
  url: string;
  publishedAt: string;
  views: number;
}

function readTrailer(value: unknown): Trailer | null {
  const resource = isRecord(value) && isRecord(value.resource) ? value.resource : null;
  const tmdbId = readFiniteNumber(resource?.tmdb_id);
  const kind = resource?.type;

  if (!isRecord(value) || !tmdbId || (kind !== "movie" && kind !== "show")) {
    return null;
  }

  const key = readNonEmptyString(value.youtube_video_id);
  const publishedAt = readNonEmptyString(value.published);

  if (!key || !publishedAt) {
    return null;
  }

  return {
    titleId: formatTitleId({ mediaType: kind === "movie" ? "movie" : "tv", tmdbId }),
    name: readNonEmptyString(value.title) ?? "Trailer",
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`,
    publishedAt,
    views: readFiniteNumber(value.views) ?? 0,
  };
}

function readEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return isRecord(payload)
    ? Object.entries(payload)
        .filter(([key]) => key !== "_metadata")
        .map(([, value]) => value)
    : [];
}

export async function fetchTrailers(apiKey: string | undefined, feed: TrailerFeed) {
  const url = new URL(`${KINOCHECK_BASE_URL}/trailers/${feed}`);

  url.search = new URLSearchParams({ language: "en", limit: KINOCHECK_PAGE_SIZE }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-api-host": "api.kinocheck.com",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    signal: AbortSignal.timeout(KINOCHECK_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `KinoCheck answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return readEntries(await response.json()).flatMap((entry) => readTrailer(entry) ?? []);
}
