import z from "zod/v4";

import {
  readTitleBackground,
  readWatchOffers,
  readTrailers,
} from "~/modules/watching/application/availability";
import { requireTitleRef } from "~/modules/watching/application/catalogue";
import { CINEMA_CHAINS, readCinemaListings } from "~/modules/watching/application/cinema";
import { markEpisodes, readEpisodeProgress } from "~/modules/watching/application/episodes";
import {
  formatBackground,
  formatCinemas,
  formatEpisodeProgress,
  formatOffers,
  formatTrailers,
} from "~/modules/watching/domain/format";
import type { ApiToolDefinition } from "~/types/functions";

import { describeTraktSync, requireContext, success, withFilmAndTvCompanions } from "./shared";

const titleIdSchema = z.string().describe("A title id such as movie:550 or tv:1399.");

const cinemaInput = z.object({
  place: z.string().min(2).describe("A town or cinema name, such as Leeds or Hackney."),
  chain: z.enum(CINEMA_CHAINS).optional(),
  film: z.string().optional().describe("Only show this film."),
  days: z.number().int().min(1).max(7).default(3),
});

export const cinema_listings: ApiToolDefinition = {
  name: "cinema_listings",
  capabilityHint: "UK showtimes",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Read what is showing at UK Cineworld, Picturehouse and Vue cinemas in a named town. Cineworld and Picturehouse give exact times and booking links; Vue gives days only. Odeon and Curzon are not available. Tell the person when a chain could not be reached rather than implying it has nothing on. Ask the person for the town and never infer it.",
  inputSchema: cinemaInput,
  execute: async (args: z.infer<typeof cinemaInput>) => {
    const listings = await readCinemaListings(args);
    const notice = listings.unavailableChains.length
      ? ` Could not reach: ${listings.unavailableChains.join(", ")}.`
      : "";

    return success(
      "cinema_listings",
      listings.cinemas.length
        ? `${formatCinemas(listings.cinemas)}${notice ? `\n\n${notice.trim()}` : ""}`
        : `No cinemas matched ${args.place}.${notice}`,
      listings,
    );
  },
};

const offersInput = z.object({
  titleId: titleIdSchema,
  region: z.string().length(2).default("GB"),
});

export const where_to_watch: ApiToolDefinition = {
  name: "where_to_watch",
  capabilityHint: "streaming, rental and purchase links",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "List every streaming, rental and purchase offer for a title in a country, with prices and direct links.",
  inputSchema: offersInput,
  execute: async (args: z.infer<typeof offersInput>, toolContext) => {
    const offers = await readWatchOffers(requireContext(toolContext), args.titleId, args.region);

    return success("where_to_watch", offers.length ? formatOffers(offers) : "No offers found.", {
      offers,
    });
  },
};

const trailersInput = z.object({ feed: z.enum(["latest", "trending"]).default("latest") });

export const latest_trailers: ApiToolDefinition = {
  name: "latest_trailers",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description: "List the newest or most-watched film and TV trailers, with links.",
  inputSchema: trailersInput,
  execute: async (args: z.infer<typeof trailersInput>, toolContext) => {
    const trailers = await readTrailers(requireContext(toolContext), args.feed);

    return success("latest_trailers", formatTrailers(trailers), { trailers });
  },
};

const backgroundInput = z.object({ titleId: titleIdSchema });

export const title_background: ApiToolDefinition = {
  name: "title_background",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description: "Read what a title is based on, where it was filmed and the awards it has won.",
  inputSchema: backgroundInput,
  execute: async (args: z.infer<typeof backgroundInput>) => {
    const background = await readTitleBackground(requireTitleRef(args.titleId));

    return success("title_background", formatBackground(background), { background });
  },
};

const markInput = z.object({
  titleId: titleIdSchema,
  season: z.number().int().min(1),
  episode: z.number().int().min(1),
  watched: z.boolean().default(true),
  upToHere: z
    .boolean()
    .default(false)
    .describe("Also mark every earlier episode, for people who do not tick as they watch."),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional().describe("Their own words, not your summary."),
});

export const mark_episodes: ApiToolDefinition = {
  name: "mark_episodes",
  capabilityHint: "tick off episodes",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input: z.infer<typeof markInput>) => ({
    operation: "mark_episodes",
    destination: "the person's film and TV shelf",
    titleId: input.titleId,
    season: input.season,
    episode: input.episode,
    watched: input.watched,
    upToHere: input.upToHere,
  }),
  description:
    "Tick off an episode of a series, or everything up to it, with an optional rating out of five and notes. The shelf follows: the series becomes watching, and watched once the last episode of a finished series is ticked.",
  inputSchema: markInput,
  execute: async (args: z.infer<typeof markInput>, toolContext) => {
    const result = await markEpisodes(requireContext(toolContext), args);

    return success(
      "mark_episodes",
      `${result.title}: ${result.marked} episode${result.marked === 1 ? "" : "s"} updated.${describeTraktSync(result.trakt ?? "")}`,
      result,
    );
  },
};

export const get_episode_progress: ApiToolDefinition = {
  name: "get_episode_progress",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description: "Read how far the person is through a series, with their episode ratings and notes.",
  inputSchema: backgroundInput,
  execute: async (args: z.infer<typeof backgroundInput>, toolContext) => {
    const progress = await readEpisodeProgress(requireContext(toolContext), args.titleId);

    return success("get_episode_progress", formatEpisodeProgress(progress), progress);
  },
};

export const SCREENING_TOOLS = withFilmAndTvCompanions([
  cinema_listings,
  where_to_watch,
  latest_trailers,
  title_background,
  mark_episodes,
  get_episode_progress,
]);
