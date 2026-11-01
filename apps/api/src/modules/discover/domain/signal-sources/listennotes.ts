import { isoDaysBefore } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { count, first, joinParts, lines, records } from "./read";
import type { DiscoverSignal } from "./types";

const LISTENNOTES_EPISODE_DAYS = 7;
const LISTENNOTES_PAGE_SIZE = 10;

function listenNotesEpisodes(result: unknown): Record<string, unknown>[] {
  return records(result, ["data", "results"], ["results"]);
}

function listenNotesItems(result: unknown): DiscoverResearchResult[] {
  return listenNotesEpisodes(result).flatMap((episode) => {
    const title = first(episode, ["title_original"], ["title"]);
    const url = first(episode, ["listennotes_url"], ["link"]);
    const published = count(episode, ["pub_date_ms"]);

    return title && url
      ? [
          {
            title,
            url,
            snippet: first(episode, ["description_original"], ["description"]).slice(0, 400),
            source:
              first(episode, ["podcast", "title_original"], ["podcast", "title"]) || "Podcast",
            date: published > 0 ? new Date(published).toISOString().slice(0, 10) : "",
            media: "listen" as const,
          },
        ]
      : [];
  });
}

export const LISTENNOTES_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "listennotes-topics",
    providerId: "listennotes",
    group: "listening",
    title: "Podcasts on your topics",
    description: "Finds this week's podcast episodes about the topics you follow.",
    operation: "LISTENNOTES_FULL_TEXT_SEARCH",
    needsTopics: true,
    parameters: ({ topics, now }) => ({
      q: `"${(topics[now.getUTCHours() % Math.max(1, topics.length)] ?? "").replace(/"/gu, "")}"`,
      type: "episode",
      sort_by_date: 1,
      unique_podcasts: 1,
      page_size: LISTENNOTES_PAGE_SIZE,
      published_after: Date.parse(isoDaysBefore(now, LISTENNOTES_EPISODE_DAYS)),
    }),
    items: (result) => listenNotesItems(result),
    digest: (result) =>
      lines(listenNotesEpisodes(result), (episode) =>
        joinParts(
          first(episode, ["title_original"], ["title"]),
          first(episode, ["podcast", "title_original"]),
        ),
      ),
  },
];
