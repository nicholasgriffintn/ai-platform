import { isRecord, readArray, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";

import {
  dayAfter,
  fetchCinemaJson,
  type Cinema,
  type CinemaSource,
  type Screening,
} from "./source";

const BASE_URL = "https://www.cineworld.co.uk/uk/data-api-service/v1/quickbook/10108";
const LISTING_WINDOW_DAYS = 30;
const IGNORED_ATTRIBUTES = new Set([
  "reserved-selected",
  "reserved-seating",
  "unreserved",
  "alcohol",
  "no-ads",
]);
const CERTIFICATES = /^(u|pg|12a?|15|18|tbc)$/u;

function readBody(payload: unknown): Record<string, unknown> {
  return isRecord(payload) && isRecord(payload.body) ? payload.body : {};
}

function readRecordsAt(payload: unknown, key: string): Record<string, unknown>[] {
  return readArray(readBody(payload)[key]).filter(isRecord);
}

function readAttributes(value: unknown): string[] {
  return readArray(value)
    .flatMap((entry) => readNonEmptyString(entry)?.toLowerCase() ?? [])
    .filter((entry) => !IGNORED_ATTRIBUTES.has(entry) && !CERTIFICATES.test(entry));
}

async function listCinemas(): Promise<Cinema[]> {
  const payload = await fetchCinemaJson(
    `${BASE_URL}/cinemas/with-event/until/${dayAfter(LISTING_WINDOW_DAYS)}?attr=&lang=en_GB`,
  );

  return readRecordsAt(payload, "cinemas").flatMap((cinema) => {
    const siteId = readNonEmptyString(cinema.id);
    const name = readNonEmptyString(cinema.displayName);

    return siteId && name
      ? [{ siteId, name: `Cineworld ${name}`, bookingUrl: readNonEmptyString(cinema.link) ?? null }]
      : [];
  });
}

async function listScreenings(cinema: Cinema, days: number): Promise<Screening[]> {
  const site = encodeURIComponent(cinema.siteId);
  const datesPayload = await fetchCinemaJson(
    `${BASE_URL}/dates/in-cinema/${site}/until/${dayAfter(days)}?attr=&lang=en_GB`,
  );
  const dates = readArray(readBody(datesPayload).dates)
    .flatMap((date) => readNonEmptyString(date) ?? [])
    .slice(0, days);
  const pages = await Promise.all(
    dates.map((date) =>
      fetchCinemaJson(`${BASE_URL}/film-events/in-cinema/${site}/at-date/${date}?attr=&lang=en_GB`),
    ),
  );

  return pages.flatMap((page) => {
    const films = new Map(
      readRecordsAt(page, "films").map((film) => [film.id, readNonEmptyString(film.name)]),
    );

    return readRecordsAt(page, "events").flatMap((event): Screening[] => {
      const film = films.get(event.filmId);
      const startsAt = readNonEmptyString(event.eventDateTime);

      return film && startsAt
        ? [
            {
              film,
              day: readNonEmptyString(event.businessDay) ?? startsAt.slice(0, 10),
              startsAt,
              precision: "exact",
              attributes: readAttributes(event.attributeIds),
              bookingUrl: readNonEmptyString(event.bookingLink) ?? null,
            },
          ]
        : [];
    });
  });
}

export const cineworldSource: CinemaSource = { id: "cineworld", listCinemas, listScreenings };
