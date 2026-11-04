export const VIEWING_STATUSES = ["watchlist", "watching", "watched", "dropped"] as const;
export const MEDIA_TYPES = ["movie", "tv"] as const;
export const DEFAULT_REGION = "GB";

export type ViewingStatus = (typeof VIEWING_STATUSES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];

export interface TitleRef {
  mediaType: MediaType;
  tmdbId: number;
}

export interface TitleScores {
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: string | null;
  metascore: number | null;
}

export interface TitleSummary extends Partial<TitleScores> {
  id: string;
  title: string;
  year: number | null;
  mediaType: MediaType;
  overview: string;
  tmdbScore: number | null;
}

const TRAILING_MEDIA_WORDS =
  /\s+(?:the\s+)?(?:tv\s+series|tv\s+show|tv\s+programme|television\s+series|series|show|film|movie)\s*$/iu;
const TITLE_ID_PATTERN = /^(movie|tv):([1-9]\d*)$/u;

export function formatTitleId(ref: TitleRef): string {
  return `${ref.mediaType}:${ref.tmdbId}`;
}

export function parseTitleId(id: string): TitleRef | null {
  const match = TITLE_ID_PATTERN.exec(id.trim());

  if (!match) {
    return null;
  }

  return { mediaType: match[1] === "tv" ? "tv" : "movie", tmdbId: Number(match[2]) };
}

export function stripMediaWords(query: string): string {
  return query.replace(TRAILING_MEDIA_WORDS, "").trim();
}

export function readReleaseYear(date: string | null | undefined): number | null {
  const year = Number(date?.slice(0, 4));

  return Number.isInteger(year) && year > 0 ? year : null;
}

function describeScores(title: Partial<TitleScores> & { tmdbScore?: number | null }): string {
  return [
    title.imdbRating ? `IMDb ${title.imdbRating}` : null,
    title.rottenTomatoes ? `RT ${title.rottenTomatoes}` : null,
    title.metascore ? `Metacritic ${title.metascore}` : null,
    !title.imdbRating && title.tmdbScore ? `TMDB ${title.tmdbScore.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function describeTitle(title: TitleSummary): string {
  const scores = describeScores(title);

  return [
    `- ${title.title}${title.year ? ` (${title.year})` : ""} [${title.id}]`,
    scores ? ` ${scores}.` : "",
    title.overview ? ` ${title.overview}` : "",
  ].join("");
}
