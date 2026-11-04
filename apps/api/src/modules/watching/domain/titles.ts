import type { TitleRef, TmdbTitleSummary } from "@ngriffin_uk/polychat-ai-integrations";

export {
  DEFAULT_REGION,
  formatTitleId,
  MEDIA_TYPES,
  readReleaseYear,
  type MediaType,
  type TitleRef,
} from "@ngriffin_uk/polychat-ai-integrations";

export const VIEWING_STATUSES = ["watchlist", "watching", "watched", "dropped"] as const;

export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export interface TitleScores {
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: string | null;
  metascore: number | null;
}

export interface TitleSummary extends TmdbTitleSummary, Partial<TitleScores> {}

const TRAILING_MEDIA_WORDS =
  /\s+(?:the\s+)?(?:tv\s+series|tv\s+show|tv\s+programme|television\s+series|series|show|film|movie)\s*$/iu;
const TITLE_ID_PATTERN = /^(movie|tv):([1-9]\d*)$/u;

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
