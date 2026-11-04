import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { cineworldSource } from "~/modules/watching/infrastructure/cinema/cineworld";
import { picturehouseSource } from "~/modules/watching/infrastructure/cinema/picturehouse";
import type { CinemaSource } from "~/modules/watching/infrastructure/cinema/source";
import { vueSource } from "~/modules/watching/infrastructure/cinema/vue";

const logger = getLogger({ prefix: "watching/cinema" });
const CINEMA_SOURCES: readonly CinemaSource[] = [cineworldSource, picturehouseSource, vueSource];
const MAX_CINEMAS = 4;

export const CINEMA_CHAINS = ["cineworld", "picturehouse", "vue"] as const;

async function findCinemas(source: CinemaSource, place: string) {
  const lower = place.trim().toLowerCase();

  try {
    const cinemas = await source.listCinemas();

    return {
      failed: false,
      matches: cinemas
        .filter((cinema) => cinema.name.toLowerCase().includes(lower))
        .map((cinema) => ({ source, cinema })),
    };
  } catch (error) {
    logger.warn("Could not list cinemas", {
      source: source.id,
      error_message: getErrorMessage(error),
    });

    return { failed: true, matches: [] };
  }
}

export async function readCinemaListings(input: {
  place: string;
  chain?: (typeof CINEMA_CHAINS)[number];
  film?: string;
  days: number;
}) {
  const sources = CINEMA_SOURCES.filter((source) => !input.chain || source.id === input.chain);
  const found = await Promise.all(sources.map((source) => findCinemas(source, input.place)));
  const matches = found.flatMap((entry) => entry.matches).slice(0, MAX_CINEMAS);
  const unavailableChains = sources
    .filter((_, index) => found[index]?.failed)
    .map((source) => source.id);
  const film = input.film?.trim().toLowerCase();

  const cinemas = await Promise.all(
    matches.map(async ({ source, cinema }) => {
      const screenings = await source.listScreenings(cinema, input.days).catch((error: unknown) => {
        logger.warn("Could not read screenings", {
          source: source.id,
          error_message: getErrorMessage(error),
        });

        return null;
      });

      return {
        cinema: cinema.name,
        bookingUrl: cinema.bookingUrl,
        available: screenings !== null,
        screenings: (screenings ?? []).filter(
          (screening) => !film || screening.film.toLowerCase().includes(film),
        ),
      };
    }),
  );

  return { cinemas, unavailableChains };
}
