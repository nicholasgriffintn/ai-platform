import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const ANILIST_URL = "https://graphql.anilist.co";
const MAL_BASE_URL = "https://api.myanimelist.net/v2/anime";
const ANIME_TIMEOUT_MS = 12_000;
const DESCRIPTION_LIMIT = 300;
const SEARCH_QUERY = `
query($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
      id
      idMal
      title { english romaji }
      format
      status
      episodes
      seasonYear
      averageScore
      genres
      description(asHtml: false)
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode { airingAt episode }
      externalLinks { site url type }
    }
  }
}`;

export interface AnimeSummary {
  anilistId: number;
  malId: number | null;
  title: string;
  format: string | null;
  status: string | null;
  episodes: number | null;
  year: number | null;
  anilistScore: number | null;
  malScore: number | null;
  malRank: number | null;
  genres: string[];
  studios: string[];
  overview: string;
  nextEpisode: { airsAt: string; episode: number } | null;
  streaming: { site: string; url: string }[];
}

function readRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function readNextEpisode(value: unknown): AnimeSummary["nextEpisode"] {
  if (!isRecord(value) || typeof value.airingAt !== "number") {
    return null;
  }

  return {
    airsAt: new Date(value.airingAt * 1000).toISOString(),
    episode: readNumber(value.episode) ?? 0,
  };
}

function readAnime(entry: Record<string, unknown>): AnimeSummary | null {
  const title = isRecord(entry.title) ? entry.title : {};
  const name = readString(title.english) ?? readString(title.romaji);
  const studios = isRecord(entry.studios) ? entry.studios : {};

  if (typeof entry.id !== "number" || !name) {
    return null;
  }

  return {
    anilistId: entry.id,
    malId: readNumber(entry.idMal),
    title: name,
    format: readString(entry.format),
    status: readString(entry.status),
    episodes: readNumber(entry.episodes),
    year: readNumber(entry.seasonYear),
    anilistScore: readNumber(entry.averageScore),
    malScore: null,
    malRank: null,
    genres: Array.isArray(entry.genres)
      ? entry.genres.filter((genre) => typeof genre === "string")
      : [],
    studios: readRecords(studios.nodes).flatMap((studio) => readString(studio.name) ?? []),
    overview: (readString(entry.description) ?? "")
      .replace(/<[^>]*>/gu, " ")
      .slice(0, DESCRIPTION_LIMIT),
    nextEpisode: readNextEpisode(entry.nextAiringEpisode),
    streaming: readRecords(entry.externalLinks).flatMap((link) => {
      const site = readString(link.site);
      const url = readString(link.url);

      return link.type === "STREAMING" && site && url ? [{ site, url }] : [];
    }),
  };
}

export async function searchAniList(query: string, limit: number): Promise<AnimeSummary[]> {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query, perPage: limit } }),
    signal: AbortSignal.timeout(ANIME_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `AniList answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const payload: unknown = await response.json();
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
  const page = isRecord(data.Page) ? data.Page : {};

  return readRecords(page.media).flatMap((entry) => readAnime(entry) ?? []);
}

export async function fetchMalScores(clientId: string, malId: number) {
  const response = await fetch(`${MAL_BASE_URL}/${malId}?fields=mean,rank`, {
    headers: { "X-MAL-CLIENT-ID": clientId, Accept: "application/json" },
    signal: AbortSignal.timeout(ANIME_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();

    return null;
  }

  const payload: unknown = await response.json();

  return isRecord(payload)
    ? { malScore: readNumber(payload.mean), malRank: readNumber(payload.rank) }
    : null;
}
