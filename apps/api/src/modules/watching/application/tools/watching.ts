import z from "zod/v4";

import {
  discoverTitles,
  findSimilarTitles,
  getSeasonRatings,
  getTitle,
  searchAnime,
  searchTitles,
  titlesByPerson,
} from "~/modules/watching/application/catalogue";
import { readShelf, saveToShelf, setPersonFollowed } from "~/modules/watching/application/shelf";
import { readReleases, readWeekAhead } from "~/modules/watching/application/updates";
import {
  formatAnimeList,
  formatShelf,
  formatTitleDetails,
  formatWhatsOn,
} from "~/modules/watching/domain/format";
import {
  describeTitle,
  MEDIA_TYPES,
  VIEWING_STATUSES,
  type TitleSummary,
} from "~/modules/watching/domain/titles";
import type { ApiToolDefinition } from "~/types/functions";

import { requireContext, success, withFilmAndTvCompanions } from "./shared";

const titleIdSchema = z.string().describe("A title id such as movie:550 or tv:1399.");
const limitSchema = z.number().int().min(1).max(25).default(10);
const regionSchema = z
  .string()
  .length(2)
  .optional()
  .describe("ISO country code for streaming services. Defaults to GB.");

function titleList(name: string, results: readonly TitleSummary[], empty: string) {
  return success(name, results.length ? results.map(describeTitle).join("\n") : empty, { results });
}

const searchInput = z.object({
  query: z
    .string()
    .min(1)
    .describe("Only the title, such as Severance. Work it out from a plot first."),
  mediaType: z.enum(MEDIA_TYPES).optional(),
  limit: limitSchema,
});

export const search_titles: ApiToolDefinition = {
  name: "search_titles",
  capabilityHint: "look up a film or show by name",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Look up or find a specific film, movie or TV show by name, with IMDb, Rotten Tomatoes and Metacritic scores. For a half-remembered plot, work out the likely title first, using web_search if needed, then search for it. Returns the title ids every other film and TV tool takes.",
  inputSchema: searchInput,
  execute: async (args: z.infer<typeof searchInput>, toolContext) =>
    titleList(
      "search_titles",
      await searchTitles(requireContext(toolContext), args),
      "No matching titles found.",
    ),
};

const discoverInput = z.object({
  mediaType: z.enum(MEDIA_TYPES),
  genres: z.array(z.string()).optional().describe("Genre names such as Comedy or Drama."),
  excludedGenres: z.array(z.string()).optional(),
  services: z
    .array(z.string())
    .optional()
    .describe("Streaming services the person pays for, such as Netflix."),
  maxRuntime: z.number().int().positive().optional().describe("Longest runtime in minutes."),
  minScore: z.number().min(0).max(10).optional().describe("Lowest TMDB score out of ten."),
  minImdbRating: z.number().min(0).max(10).optional().describe("Lowest IMDb rating out of ten."),
  releasedAfter: z.iso.date().optional(),
  maxCertification: z
    .enum(["U", "PG", "12A", "12", "15", "18"])
    .optional()
    .describe("Highest certificate. Films only."),
  region: regionSchema,
  limit: limitSchema,
});

export const discover_titles: ApiToolDefinition = {
  name: "discover_titles",
  capabilityHint: "browse by genre, runtime or service",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Browse for something to watch when no title is named, by genre, runtime, certificate, score and streaming service. When someone cannot decide what to watch, ask at most three questions: who is in the room, how long they have, and their mood. Read get_shelf for their taste and skip what they have seen, then commit to one title with one sentence on why and two backups, naming the service for each from get_title. With children in the room, exclude Horror, Thriller, Crime and War and set maxCertification to PG.",
  inputSchema: discoverInput,
  execute: async (args: z.infer<typeof discoverInput>, toolContext) =>
    titleList(
      "discover_titles",
      await discoverTitles(requireContext(toolContext), args),
      "Nothing matched. Loosen a filter and try again.",
    ),
};

const getTitleInput = z.object({ titleId: titleIdSchema, region: regionSchema });

export const get_title: ApiToolDefinition = {
  name: "get_title",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Read one film or series in full: plot, cast, directors, writers, runtime, certificate, IMDb, Rotten Tomatoes and Metacritic scores, awards, box office, the next episode, and where to stream, rent or buy it.",
  inputSchema: getTitleInput,
  execute: async (args: z.infer<typeof getTitleInput>, toolContext) => {
    const title = await getTitle(requireContext(toolContext), args.titleId, args.region);

    return success("get_title", formatTitleDetails(title), { title });
  },
};

const seasonInput = z.object({
  titleId: titleIdSchema,
  season: z.number().int().min(1),
});

export const get_season_ratings: ApiToolDefinition = {
  name: "get_season_ratings",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "List every episode of one season of a series with its air date and IMDb rating. Use it to find the best or worst episodes.",
  inputSchema: seasonInput,
  execute: async (args: z.infer<typeof seasonInput>, toolContext) => {
    const episodes = await getSeasonRatings(requireContext(toolContext), args.titleId, args.season);

    return success(
      "get_season_ratings",
      episodes.length
        ? episodes
            .map(
              (entry) =>
                `- E${entry.episode} ${entry.title} (${entry.released ?? "undated"}): ${entry.imdbRating ?? "unrated"}`,
            )
            .join("\n")
        : "No episodes found for that season.",
      { episodes },
    );
  },
};

const similarInput = z.object({ titleId: titleIdSchema, limit: limitSchema });

export const find_similar_titles: ApiToolDefinition = {
  name: "find_similar_titles",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description: "Find films or series like one the person names, with critic and audience scores.",
  inputSchema: similarInput,
  execute: async (args: z.infer<typeof similarInput>, toolContext) =>
    titleList(
      "find_similar_titles",
      await findSimilarTitles(requireContext(toolContext), args.titleId, args.limit),
      "No similar titles found.",
    ),
};

const personInput = z.object({ name: z.string().min(1), limit: limitSchema });

export const titles_by_person: ApiToolDefinition = {
  name: "titles_by_person",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description: "List the films and series an actor or director has made, newest first.",
  inputSchema: personInput,
  execute: async (args: z.infer<typeof personInput>, toolContext) => {
    const { person, results } = await titlesByPerson(
      requireContext(toolContext),
      args.name,
      args.limit,
    );

    return person
      ? titleList("titles_by_person", results, `No credits found for ${person.name}.`)
      : success("titles_by_person", `No one called ${args.name} was found.`, { results: [] });
  },
};

const animeInput = z.object({ query: z.string().min(1), limit: limitSchema });

export const search_anime: ApiToolDefinition = {
  name: "search_anime",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Search anime with AniList and MyAnimeList scores, episodes, studios, where to stream it, and when the next episode airs. Prefer it to search_titles for anime.",
  inputSchema: animeInput,
  execute: async (args: z.infer<typeof animeInput>, toolContext) => {
    const results = await searchAnime(requireContext(toolContext), args.query, args.limit);

    return success(
      "search_anime",
      results.length ? formatAnimeList(results) : "No matching anime found.",
      { results },
    );
  },
};

const shelfInput = z.object({ status: z.enum(VIEWING_STATUSES).optional() });

export const get_shelf: ApiToolDefinition = {
  name: "get_shelf",
  capabilityHint: "the watchlist and what has been watched",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Read the person's film and TV shelf: what they have watched, are watching, want to watch or dropped, with their rating out of five and their thoughts, plus the people they follow. Use it as the record of their taste.",
  inputSchema: shelfInput,
  execute: async (args: z.infer<typeof shelfInput>, toolContext) => {
    const shelf = await readShelf(requireContext(toolContext), args.status);

    return success("get_shelf", formatShelf(shelf), shelf);
  },
};

const weekInput = z.object({
  days: z.number().int().min(1).max(60).default(7).describe("How many days ahead to look."),
});

export const whats_on: ApiToolDefinition = {
  name: "whats_on",
  capabilityHint: "what is coming up this week, personal and general",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "List what is coming up: episodes and releases from the person's shelf, plus popular new films and series with new episodes. Use one day for tonight. Episodes carry a clock time when TVmaze knows it, otherwise only the day.",
  inputSchema: weekInput,
  execute: async (args: z.infer<typeof weekInput>, toolContext) => {
    const context = requireContext(toolContext);
    const [week, releases] = await Promise.all([
      readWeekAhead(context, args.days),
      readReleases(context, args.days),
    ]);

    return success(
      "whats_on",
      formatWhatsOn({ days: args.days, shelf: week.entries, ...releases }),
      { ...week, ...releases },
    );
  },
};

const saveInput = z.object({
  titleId: titleIdSchema,
  status: z.enum(VIEWING_STATUSES),
  rating: z.number().int().min(1).max(5).optional().describe("Their rating out of five."),
  thoughts: z.string().max(2000).optional().describe("Their own words, not your summary."),
});

export const save_to_shelf: ApiToolDefinition = {
  name: "save_to_shelf",
  capabilityHint: "add to the watchlist, mark as watched, rate",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input: z.infer<typeof saveInput>) => ({
    operation: "save_to_shelf",
    destination: "the person's film and TV shelf",
    titleId: input.titleId,
    status: input.status,
    rating: input.rating,
  }),
  description:
    "Record a film or series on the person's shelf as watched, watching, watchlist or dropped, with an optional rating out of five and their thoughts. Find the title with search_titles first. An existing rating or thoughts stay unless new ones are given.",
  inputSchema: saveInput,
  execute: async (args: z.infer<typeof saveInput>, toolContext) => {
    const saved = await saveToShelf(requireContext(toolContext), args);

    return success("save_to_shelf", `${saved.title} saved as ${saved.status}.`, saved);
  },
};

const followInput = z.object({ name: z.string().min(1), follow: z.boolean() });

export const follow_person: ApiToolDefinition = {
  name: "follow_person",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input: z.infer<typeof followInput>) => ({
    operation: "follow_person",
    destination: "the person's film and TV shelf",
    name: input.name,
    follow: input.follow,
  }),
  description: "Follow or unfollow an actor or director on the person's film and TV shelf.",
  inputSchema: followInput,
  execute: async (args: z.infer<typeof followInput>, toolContext) => {
    const person = await setPersonFollowed(requireContext(toolContext), args);

    return success(
      "follow_person",
      `${args.follow ? "Now following" : "No longer following"} ${person.name}.`,
      { person, following: args.follow },
    );
  },
};

export const WATCHING_TOOLS = withFilmAndTvCompanions([
  search_titles,
  discover_titles,
  get_title,
  get_season_ratings,
  find_similar_titles,
  titles_by_person,
  search_anime,
  get_shelf,
  whats_on,
  save_to_shelf,
  follow_person,
]);
