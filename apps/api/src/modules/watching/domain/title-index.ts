export interface IndexableTitle {
  title: string;
  year: number | null;
  mediaType: "movie" | "tv";
  genres: readonly string[];
  keywords: readonly string[];
  cast: readonly string[];
  directors: readonly string[];
  studios: readonly string[];
  overview: string;
}

export function buildEmbeddingText(title: IndexableTitle): string {
  return [
    title.title,
    title.year ? String(title.year) : "",
    title.mediaType === "movie" ? "film" : "television series",
    title.genres.join(", "),
    title.keywords.join(", "),
    [...title.directors, ...title.cast].join(", "),
    title.studios.join(", "),
    title.overview,
  ]
    .filter(Boolean)
    .join(" · ");
}
