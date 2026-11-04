interface TitleDetails {
  id: string;
  title: string;
  year?: number | null;
  overview?: string;
  certification?: string | null;
  runtimeMinutes?: number | null;
  genres: readonly string[];
  imdbRating?: number | null;
  imdbVotes?: number | null;
  rottenTomatoes?: string | null;
  metascore?: number | null;
  tmdbScore?: number | null;
  directors: readonly string[];
  writers: readonly string[];
  cast: readonly string[];
  seasons?: number | null;
  nextEpisode?: {
    airDate: string;
    season?: number | null;
    episode?: number | null;
    name: string;
  } | null;
  services: { streaming: readonly string[]; rent: readonly string[]; buy: readonly string[] };
  awards?: string | null;
  boxOffice?: string | null;
}

interface ReleaseTitle {
  id: string;
  title: string;
  year?: number | null;
}

function join(parts: readonly (string | null | undefined | false)[], separator = " · "): string {
  return parts.filter(Boolean).join(separator);
}

function field(label: string, value: string | readonly string[] | null | undefined): string | null {
  const text = typeof value === "string" ? value : value?.join(", ");

  return text ? `- **${label}:** ${text}` : null;
}

function heading(title: string, year: number | null | undefined, id: string): string {
  return `**${title}**${year ? ` (${year})` : ""} · \`${id}\``;
}

function episodeLabel(season?: number | null, episode?: number | null): string {
  return season ? `S${season}E${episode ?? "?"}` : "";
}

export function formatTitleDetails(title: TitleDetails): string {
  const facts = join([
    title.certification,
    title.runtimeMinutes ? `${title.runtimeMinutes} min` : null,
    title.seasons ? `${title.seasons} seasons` : null,
    title.genres.join(", "),
  ]);
  const scores = join([
    title.imdbRating
      ? `IMDb ${title.imdbRating}${title.imdbVotes ? ` (${title.imdbVotes.toLocaleString("en-GB")} votes)` : ""}`
      : null,
    title.rottenTomatoes ? `Rotten Tomatoes ${title.rottenTomatoes}` : null,
    title.metascore ? `Metacritic ${title.metascore}` : null,
    title.tmdbScore ? `TMDB ${title.tmdbScore.toFixed(1)}` : null,
  ]);
  const next = title.nextEpisode;

  return [
    join([heading(title.title, title.year, title.id), facts]),
    scores,
    "",
    title.overview,
    "",
    field("Directed by", title.directors),
    field("Written by", title.writers),
    field("Cast", title.cast),
    field("Stream", title.services.streaming),
    field("Rent", title.services.rent),
    field("Buy", title.services.buy),
    next
      ? field(
          "Next episode",
          join([next.airDate, episodeLabel(next.season, next.episode), next.name]),
        )
      : null,
    field("Awards", title.awards),
    field("Box office", title.boxOffice),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n")
    .trim();
}

export function formatAnimeList(
  results: readonly {
    title: string;
    year?: number | null;
    format?: string | null;
    episodes?: number | null;
    anilistScore?: number | null;
    malScore?: number | null;
    studios: readonly string[];
    nextEpisode?: { airsAt: string; episode: number } | null;
    streaming: readonly { site: string; url: string }[];
    overview: string;
  }[],
): string {
  return results
    .map((anime) =>
      [
        `**${anime.title}**${anime.year ? ` (${anime.year})` : ""}`,
        join([
          anime.format,
          anime.episodes ? `${anime.episodes} episodes` : null,
          anime.anilistScore ? `AniList ${anime.anilistScore}` : null,
          anime.malScore ? `MyAnimeList ${anime.malScore}` : null,
          anime.studios.join(", "),
        ]),
        anime.overview,
        field(
          "Stream",
          anime.streaming.map((link) => `[${link.site}](${link.url})`),
        ),
        anime.nextEpisode
          ? field("Next episode", `${anime.nextEpisode.episode} on ${anime.nextEpisode.airsAt}`)
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

const SHELF_SECTIONS = [
  ["watching", "Watching"],
  ["watchlist", "Watchlist"],
  ["watched", "Watched"],
  ["dropped", "Dropped"],
] as const;

export function formatShelf(shelf: {
  entries: readonly {
    id: string;
    title: string;
    year?: number | null;
    status: string;
    rating?: number | null;
    thoughts?: string | null;
  }[];
  following: readonly string[];
}): string {
  const sections = SHELF_SECTIONS.flatMap(([status, label]) => {
    const entries = shelf.entries.filter((entry) => entry.status === status);

    return entries.length > 0
      ? [
          `**${label}**`,
          ...entries.map(
            (entry) =>
              `- ${join([
                `${entry.title}${entry.year ? ` (${entry.year})` : ""} \`${entry.id}\``,
                entry.rating ? `${entry.rating}/5` : null,
                entry.thoughts,
              ])}`,
          ),
          "",
        ]
      : [];
  });
  const following =
    shelf.following.length > 0 ? [`**Following:** ${shelf.following.join(", ")}`] : [];

  return [...sections, ...following].join("\n").trim() || "The shelf is empty.";
}

function formatWhen(when: string): string {
  const date = when.slice(0, 10);

  return when.length > 10 ? `${date} ${when.slice(11, 16)}` : date;
}

export function formatWeekAhead(
  entries: readonly {
    title: string;
    when: string;
    season?: number | null;
    episode?: number | null;
    name?: string;
    network?: string;
  }[],
): string {
  return entries
    .map(
      (entry) =>
        `- ${join([
          formatWhen(entry.when),
          `**${entry.title}**`,
          episodeLabel(entry.season, entry.episode),
          entry.name,
          entry.network,
        ])}`,
    )
    .join("\n");
}

export function formatCinemas(
  cinemas: readonly {
    cinema: string;
    available: boolean;
    screenings: readonly {
      film: string;
      day: string;
      startsAt: string | null;
      bookingUrl: string | null;
    }[];
  }[],
): string {
  return cinemas
    .map(({ cinema, available, screenings }) => {
      if (!available) {
        return `**${cinema}**\nListings could not be read.`;
      }

      const films = new Map<string, string[]>();

      for (const screening of screenings) {
        const time = screening.startsAt ? formatWhen(screening.startsAt) : screening.day;
        const label = screening.bookingUrl ? `[${time}](${screening.bookingUrl})` : time;

        films.set(screening.film, [...(films.get(screening.film) ?? []), label]);
      }

      return [
        `**${cinema}**`,
        ...[...films].map(([film, times]) => `- ${film}: ${times.join(", ")}`),
      ].join("\n");
    })
    .join("\n\n");
}

export function formatOffers(
  offers: readonly {
    service: string;
    type: string;
    quality: string | null;
    price: string | null;
    url: string;
  }[],
): string {
  return offers
    .map(
      (offer) =>
        `- [${offer.service}](${offer.url}): ${join([offer.type, offer.quality, offer.price])}`,
    )
    .join("\n");
}

export function formatTrailers(
  trailers: readonly { titleId: string; name: string; url: string }[],
): string {
  return trailers
    .map((trailer) => `- [${trailer.name}](${trailer.url}) \`${trailer.titleId}\``)
    .join("\n");
}

export function formatBackground(background: {
  basedOn: readonly string[];
  filmingLocation: readonly string[];
  award: readonly string[];
}): string {
  return (
    [
      field("Based on", background.basedOn),
      field("Filmed in", background.filmingLocation),
      field("Awards", background.award),
    ]
      .filter(Boolean)
      .join("\n") || "No background found."
  );
}

export function formatEpisodeProgress(progress: {
  watchedCount: number;
  furthest: { season: number; episode: number } | null;
  episodes: readonly {
    season: number;
    episode: number;
    watched: boolean;
    rating?: number | null;
    notes?: string | null;
  }[];
}): string {
  if (!progress.furthest) {
    return "No episodes ticked off yet.";
  }

  const annotated = progress.episodes
    .filter((episode) => episode.rating || episode.notes)
    .map(
      (episode) =>
        `- ${join([
          episodeLabel(episode.season, episode.episode),
          episode.rating ? `${episode.rating}/5` : null,
          episode.notes,
        ])}`,
    );

  return [
    `${progress.watchedCount} watched, furthest ${episodeLabel(progress.furthest.season, progress.furthest.episode)}.`,
    ...annotated,
  ].join("\n");
}

function formatReleaseList(label: string, titles: readonly ReleaseTitle[]): string[] {
  return titles.length > 0
    ? [
        `**${label}**`,
        ...titles.map(
          (title) => `- ${title.title}${title.year ? ` (${title.year})` : ""} \`${title.id}\``,
        ),
        "",
      ]
    : [];
}

export function formatWhatsOn(input: {
  days: number;
  shelf: Parameters<typeof formatWeekAhead>[0];
  films: readonly ReleaseTitle[];
  series: readonly ReleaseTitle[];
}): string {
  return [
    "**From your shelf**",
    input.shelf.length > 0
      ? formatWeekAhead(input.shelf)
      : `Nothing from your shelf in the next ${input.days} days.`,
    "",
    ...formatReleaseList("New films", input.films),
    ...formatReleaseList("Series with new episodes", input.series),
  ]
    .join("\n")
    .trim();
}
