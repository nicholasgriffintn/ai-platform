import { isRecord, readFiniteNumber, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";
import { fetchJson } from "@ngriffin_uk/polychat-utility-server/http";

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

  const payload = await fetchJson(url, {
    service: "KinoCheck",
    headers: {
      "x-api-host": "api.kinocheck.com",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    timeoutMs: KINOCHECK_TIMEOUT_MS,
  });

  return readEntries(payload).flatMap((entry) => readTrailer(entry) ?? []);
}
