import { isRecord, readArray, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import {
  dayAfter,
  fetchCinemaJson,
  fetchCinemaResponse,
  type Cinema,
  type CinemaSource,
  type Screening,
} from "./source";

const ORIGIN = "https://www.picturehouses.com";
const SLUG_PATTERN = /https:\/\/www\.picturehouses\.com\/cinema\/([a-z0-9-]+)/gu;
const SITE_ID_PATTERN = /cinema_id: *"(\d{3})"/u;
const MAX_SITES = 40;
const SITE_CONCURRENCY = 6;
const IGNORED_ATTRIBUTES = new Set(["reserved", "unreserved", "allocated"]);

async function fetchPage(path: string): Promise<string> {
  const response = await fetchCinemaResponse(`${ORIGIN}${path}`, {
    headers: { accept: "text/html" },
  });

  return response.text();
}

function nameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

async function listCinemas(): Promise<Cinema[]> {
  const index = await fetchPage("/cinemas");
  const slugs = [...new Set([...index.matchAll(SLUG_PATTERN)].flatMap((match) => match[1] ?? []))];
  const sites = await mapWithConcurrency(
    slugs.slice(0, MAX_SITES),
    SITE_CONCURRENCY,
    async (slug) => {
      const page = await fetchPage(`/cinema/${slug}`).catch(() => "");
      const siteId = SITE_ID_PATTERN.exec(page)?.[1];

      return siteId
        ? [
            {
              siteId,
              name: `Picturehouse ${nameFromSlug(slug).replace(/ Picturehouse$/u, "")}`,
              bookingUrl: `${ORIGIN}/cinema/${slug}`,
            },
          ]
        : [];
    },
  );

  return sites.flat();
}

function readAttributes(value: unknown): string[] {
  return readArray(value)
    .flatMap((entry) => readNonEmptyString(entry)?.toLowerCase().trim() ?? [])
    .filter((entry) => !IGNORED_ATTRIBUTES.has(entry));
}

async function listScreenings(cinema: Cinema, days: number): Promise<Screening[]> {
  const payload = await fetchCinemaJson(`${ORIGIN}/api/scheduled-movies-ajax`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
    },
    body: new URLSearchParams({ cinema_id: cinema.siteId }).toString(),
  });
  const movies = isRecord(payload) ? readArray(payload.movies).filter(isRecord) : [];
  const cutoff = dayAfter(days);

  return movies.flatMap((movie) => {
    const film = readNonEmptyString(movie.Title);
    const filmId = readNonEmptyString(movie.ScheduledFilmId);

    if (!film || !filmId) {
      return [];
    }

    return readArray(movie.show_times)
      .filter(isRecord)
      .flatMap((showing): Screening[] => {
        const startsAt = readNonEmptyString(showing.Showtime);
        const day = readNonEmptyString(showing.date_f) ?? startsAt?.slice(0, 10);
        const sessionId = readNonEmptyString(showing.SessionId);

        if (showing.CinemaId !== cinema.siteId || !startsAt || !day || day > cutoff) {
          return [];
        }

        return [
          {
            film,
            day,
            startsAt,
            precision: "exact",
            attributes: readAttributes(showing.SessionAttributesNames),
            bookingUrl: sessionId
              ? `${ORIGIN}/movie-details/${encodeURIComponent(cinema.siteId)}/${encodeURIComponent(filmId)}/${encodeURIComponent(sessionId)}`
              : cinema.bookingUrl,
          },
        ];
      });
  });
}

export const picturehouseSource: CinemaSource = {
  id: "picturehouse",
  listCinemas,
  listScreenings,
};
