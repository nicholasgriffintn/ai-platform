import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { first, items, lines, joinParts } from "./read";
import type { DiscoverSignal } from "./types";

export const WATCHING_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "trakt-history",
    providerId: "trakt",
    group: "watching",
    title: "Trakt",
    description: "Reads the films and shows you have watched.",
    operation: "get_history",
    parameters: () => ({ type: "shows", limit: 20 }),
    digest: (result) =>
      lines(items(result, ["data"], []), (entry) =>
        joinParts(
          first(entry, ["show", "title"], ["movie", "title"]),
          first(entry, ["episode", "title"]),
          first(entry, ["watched_at"]).slice(0, 10),
        ),
      ),
  },
  {
    id: "watching-shelf",
    kind: "first_party",
    source: "shelf",
    providerId: "watching",
    group: "watching",
    title: "Film and TV shelf",
    description: "Reads what you are watching and want to watch.",
    digest: (result) =>
      lines(
        items(result, ["entries"]).filter(
          (entry) => isRecord(entry) && entry.status !== "watched" && entry.status !== "dropped",
        ),
        (entry) =>
          joinParts(
            first(entry, ["title"]),
            first(entry, ["year"]),
            first(entry, ["status"]),
            first(entry, ["thoughts"]).slice(0, 100),
          ),
      ),
  },
  {
    id: "watching-week",
    kind: "first_party",
    source: "week_ahead",
    providerId: "watching",
    group: "watching",
    title: "Film and TV week ahead",
    description: "Reads the episodes and releases coming this week from your shelf.",
    digest: (result) =>
      lines(items(result, ["entries"]), (entry) =>
        joinParts(
          first(entry, ["when"]),
          first(entry, ["title"]),
          first(entry, ["season"]) && `S${first(entry, ["season"])}E${first(entry, ["episode"])}`,
          first(entry, ["name"]),
        ),
      ),
  },
  {
    id: "watching-news",
    kind: "first_party",
    source: "news",
    providerId: "watching",
    group: "watching",
    title: "Film and TV news",
    description: "Reads new seasons, arrivals, trailers and people you follow.",
    items: (result) =>
      items(result, ["news"]).flatMap((entry) =>
        first(entry, ["url"])
          ? [
              {
                title: first(entry, ["headline"]),
                url: first(entry, ["url"]),
                snippet: first(entry, ["detail"]),
                source: "Film and TV",
                media: "watch" as const,
              },
            ]
          : [],
      ),
    digest: (result) =>
      lines(items(result, ["news"]), (entry) =>
        joinParts(first(entry, ["headline"]), first(entry, ["detail"])),
      ),
  },
];
