import { isRecord, readArray, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import {
  dayAfter,
  fetchCinemaJson,
  type Cinema,
  type CinemaSource,
  type Screening,
} from "./source";

const BASE_URL = "https://www.myvue.com/api/microservice/showings";
const MAX_FILMS_PER_SITE = 30;
const FILM_CONCURRENCY = 5;

function readResult(payload: unknown): Record<string, unknown>[] {
  return isRecord(payload) ? readArray(payload.result).filter(isRecord) : [];
}

async function listCinemas(): Promise<Cinema[]> {
  const groups = readResult(await fetchCinemaJson(`${BASE_URL}/cinemas`));

  return groups.flatMap((group) =>
    readArray(group.cinemas)
      .filter(isRecord)
      .flatMap((cinema) => {
        const siteId = readNonEmptyString(cinema.cinemaId);
        const name = readNonEmptyString(cinema.cinemaName) ?? readNonEmptyString(cinema.fullName);

        return siteId && name && cinema.venueCurrency === "GBP"
          ? [
              {
                siteId,
                name: `Vue ${name}`,
                bookingUrl: readNonEmptyString(cinema.whatsOnUrl) ?? null,
              },
            ]
          : [];
      }),
  );
}

async function listDays(siteId: string, filmId: string): Promise<string[]> {
  const params = new URLSearchParams({
    cinemaId: siteId,
    filmId,
    minEmbargoLevel: "1",
    forNextWeek: "true",
  });
  const entries = readResult(await fetchCinemaJson(`${BASE_URL}/showingDates?${params}`));

  return entries.flatMap((entry) => {
    const date = readNonEmptyString(entry.showingDate);

    return date && entry.hasShowings === true ? [date.slice(0, 10)] : [];
  });
}

async function listScreenings(cinema: Cinema, days: number): Promise<Screening[]> {
  const params = new URLSearchParams({ cinemaId: cinema.siteId });
  const films = readResult(await fetchCinemaJson(`${BASE_URL}/films?${params}`)).slice(
    0,
    MAX_FILMS_PER_SITE,
  );
  const cutoff = dayAfter(days);
  const screenings = await mapWithConcurrency(films, FILM_CONCURRENCY, async (film) => {
    const filmId = readNonEmptyString(film.filmId);
    const title = readNonEmptyString(film.filmTitle);

    if (!filmId || !title) {
      return [];
    }

    const showingDays = await listDays(cinema.siteId, filmId).catch(() => []);

    return showingDays
      .filter((day) => day <= cutoff)
      .map((day): Screening => ({
        film: title,
        day,
        startsAt: null,
        precision: "day",
        attributes: [],
        bookingUrl: readNonEmptyString(film.filmUrl) ?? cinema.bookingUrl,
      }));
  });

  return screenings.flat();
}

export const vueSource: CinemaSource = { id: "vue", listCinemas, listScreenings };
