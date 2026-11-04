import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { MediaType, TitleScores } from "./titles";

const IMDB_ID_PATTERN = /^tt\d+$/u;
const NOT_FOUND_ERRORS = [
  "movie not found",
  "series not found",
  "episode not found",
  "incorrect imdb id",
  "too many results",
];

export interface OmdbTitle extends TitleScores {
  imdbId: string | null;
  title: string;
  year: number | null;
  mediaType: MediaType;
  certification: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  plot: string | null;
  directors: string[];
  writers: string[];
  actors: string[];
  awards: string | null;
  boxOffice: string | null;
  totalSeasons: number | null;
}

export interface OmdbEpisode {
  episode: number;
  title: string;
  released: string | null;
  imdbId: string | null;
  imdbRating: number | null;
}

export interface OmdbSearchResult {
  imdbId: string;
  title: string;
  year: number | null;
  mediaType: MediaType;
}

export type OmdbAnswer =
  | { kind: "found"; payload: Record<string, unknown> }
  | { kind: "missing" }
  | { kind: "limited" }
  | { kind: "failed"; message: string };

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed && trimmed !== "N/A" ? trimmed : null;
}

function readList(value: unknown): string[] {
  return [
    ...new Set(
      (readText(value) ?? "")
        .split(",")
        .map((entry) => entry.replace(/\s*\([^)]*\)\s*$/u, "").trim())
        .filter(Boolean),
    ),
  ];
}

function readNumber(value: unknown): number | null {
  const raw = readText(value);
  const parsed = raw ? Number(raw.replaceAll(",", "")) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function readYear(value: unknown): number | null {
  const year = Number(readText(value)?.slice(0, 4));

  return Number.isInteger(year) && year > 0 ? year : null;
}

function readImdbId(value: unknown): string | null {
  return typeof value === "string" && IMDB_ID_PATTERN.test(value) ? value : null;
}

function readMediaType(value: unknown): MediaType {
  return value === "series" ? "tv" : "movie";
}

function readRating(payload: Record<string, unknown>, source: string): string | null {
  const ratings = Array.isArray(payload.Ratings) ? payload.Ratings : [];
  const match = ratings.find((entry) => isRecord(entry) && entry.Source === source);

  return isRecord(match) ? readText(match.Value) : null;
}

function readRuntime(value: unknown): number | null {
  const match = /(\d+)\s*min/iu.exec(readText(value) ?? "");

  return match ? Number(match[1]) : null;
}

export function classifyOmdbAnswer(payload: unknown): OmdbAnswer {
  if (!isRecord(payload)) {
    return { kind: "failed", message: "OMDb returned an invalid payload" };
  }

  if (payload.Response !== "False") {
    return { kind: "found", payload };
  }

  const error = readText(payload.Error) ?? "OMDb has no record";
  const lower = error.toLowerCase();

  if (lower.includes("limit")) {
    return { kind: "limited" };
  }

  return NOT_FOUND_ERRORS.some((known) => lower.includes(known))
    ? { kind: "missing" }
    : { kind: "failed", message: `OMDb reported an error: ${error.slice(0, 200)}` };
}

export function readOmdbTitle(payload: Record<string, unknown>): OmdbTitle {
  return {
    imdbId: readImdbId(payload.imdbID),
    title: readText(payload.Title) ?? "",
    year: readYear(payload.Year),
    mediaType: readMediaType(payload.Type),
    certification: readText(payload.Rated),
    runtimeMinutes: readRuntime(payload.Runtime),
    genres: readList(payload.Genre),
    plot: readText(payload.Plot),
    directors: readList(payload.Director),
    writers: readList(payload.Writer),
    actors: readList(payload.Actors),
    awards: readText(payload.Awards),
    boxOffice: readText(payload.BoxOffice),
    totalSeasons: readNumber(payload.totalSeasons),
    imdbRating: readNumber(payload.imdbRating),
    imdbVotes: readNumber(payload.imdbVotes),
    rottenTomatoes: readRating(payload, "Rotten Tomatoes"),
    metascore: readNumber(payload.Metascore),
  };
}

export function readOmdbEpisodes(payload: Record<string, unknown>): OmdbEpisode[] {
  const episodes = Array.isArray(payload.Episodes) ? payload.Episodes : [];

  return episodes.flatMap((entry): OmdbEpisode[] => {
    const episode = isRecord(entry) ? readNumber(entry.Episode) : null;

    if (!isRecord(entry) || episode === null) {
      return [];
    }

    return [
      {
        episode,
        title: readText(entry.Title) ?? "",
        released: readText(entry.Released),
        imdbId: readImdbId(entry.imdbID),
        imdbRating: readNumber(entry.imdbRating),
      },
    ];
  });
}

export function readOmdbSearch(payload: Record<string, unknown>): OmdbSearchResult[] {
  const results = Array.isArray(payload.Search) ? payload.Search : [];

  return results.flatMap((entry): OmdbSearchResult[] => {
    const imdbId = isRecord(entry) ? readImdbId(entry.imdbID) : null;
    const title = isRecord(entry) ? readText(entry.Title) : null;

    if (!isRecord(entry) || !imdbId || !title) {
      return [];
    }

    return [{ imdbId, title, year: readYear(entry.Year), mediaType: readMediaType(entry.Type) }];
  });
}
