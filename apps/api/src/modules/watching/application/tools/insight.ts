import z from "zod/v4";

import { recommendFromTaste, searchByMeaning } from "~/modules/watching/application/semantic";
import { importFromTrakt, startTraktConnection } from "~/modules/watching/application/trakt";
import { describeTitle, MEDIA_TYPES } from "~/modules/watching/domain/titles";
import type { ApiToolDefinition } from "~/types/functions";

import { requireContext, success, withFilmAndTvCompanions } from "./shared";

const limitSchema = z.number().int().min(1).max(25).default(10);

const meaningInput = z.object({
  query: z.string().min(2).describe("A plot, mood or half-remembered scene, in plain words."),
  mediaType: z.enum(MEDIA_TYPES).optional(),
  limit: limitSchema,
});

export const search_by_meaning: ApiToolDefinition = {
  name: "search_by_meaning",
  capabilityHint: "find by plot or mood",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Find films and series by what they are about rather than what they are called. Use it for half-remembered plots and moods.",
  inputSchema: meaningInput,
  execute: async (args: z.infer<typeof meaningInput>, toolContext) => {
    const results = await searchByMeaning(requireContext(toolContext), args);

    return success(
      "search_by_meaning",
      results.length ? results.map(describeTitle).join("\n") : "Nothing close to that was found.",
      { results },
    );
  },
};

const recommendInput = z.object({ limit: limitSchema });

export const recommend_from_taste: ApiToolDefinition = {
  name: "recommend_from_taste",
  capabilityHint: "personal recommendations",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Recommend titles close to the person's taste, worked out from what they rated, watched and dropped, skipping anything already on their shelf.",
  inputSchema: recommendInput,
  execute: async (args: z.infer<typeof recommendInput>, toolContext) => {
    const results = await recommendFromTaste(requireContext(toolContext), args.limit);

    return success(
      "recommend_from_taste",
      results.length ? results.map(describeTitle).join("\n") : "The shelf is too thin to go on.",
      { results },
    );
  },
};

const noInput = z.object({});

export const connect_trakt: ApiToolDefinition = {
  name: "connect_trakt",
  capabilityHint: "link a Trakt account so saves sync there",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "credential" },
  description:
    "Create a link the person opens to connect their Trakt account, so shelf saves and ticked episodes are also sent to Trakt.",
  inputSchema: noInput,
  execute: async (_args: z.infer<typeof noInput>, toolContext) => {
    const url = await startTraktConnection(requireContext(toolContext));

    return success("connect_trakt", `Open this link within ten minutes: ${url}`, { url });
  },
};

export const import_from_trakt: ApiToolDefinition = {
  name: "import_from_trakt",
  capabilityHint: "bring Trakt history onto the shelf",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: () => ({
    operation: "import_from_trakt",
    destination: "the person's film and TV shelf",
  }),
  description:
    "Bring Trakt history, ratings and watchlist onto the shelf, with IMDb IDs and each show's watched and unwatched episode counts. Titles already on the shelf keep what the person set here and get their Trakt counts refreshed.",
  inputSchema: noInput,
  execute: async (_args: z.infer<typeof noInput>, toolContext) => {
    const result = await importFromTrakt(requireContext(toolContext));

    return result
      ? success(
          "import_from_trakt",
          `${result.added} titles added to the shelf. Trakt details refreshed on ${result.updated} others.`,
          result,
        )
      : success("import_from_trakt", "Connect Trakt first with connect_trakt.", {});
  },
};

export const INSIGHT_TOOLS = withFilmAndTvCompanions([
  search_by_meaning,
  recommend_from_taste,
  connect_trakt,
  import_from_trakt,
]);
