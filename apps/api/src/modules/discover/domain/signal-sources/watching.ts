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
    id: "marquee-shelf",
    providerId: "marquee",
    group: "watching",
    title: "Marquee shelf",
    description: "Reads what you are watching and want to watch on Marquee.",
    operation: "get_shelf",
    parameters: () => ({}),
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
    id: "marquee-week",
    providerId: "marquee",
    group: "watching",
    title: "Marquee week ahead",
    description: "Reads the episodes and releases coming this week on your Marquee shelf.",
    operation: "whats_on_this_week",
    parameters: () => ({ days: 7 }),
    digest: (result) =>
      lines(items(result, ["entries"]), (entry) =>
        joinParts(
          first(entry, ["when"]).slice(0, 16).replace("T", " "),
          first(entry, ["title"]),
          first(entry, ["season"]) && `S${first(entry, ["season"])}E${first(entry, ["episode"])}`,
          first(entry, ["name"]),
          first(entry, ["network"]),
        ),
      ),
  },
];
