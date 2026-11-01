import { count, describeEngagement, first, items, joinParts, lines, records } from "./read";
import type { DiscoverSignal } from "./types";

const DEVTO_MIN_REACTIONS = 20;

export const DEVTO_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "devto-reading-list",
    providerId: "devto",
    group: "reading",
    title: "DEV Community",
    description: "Reads your DEV reading list.",
    operation: "DEVTO_LIST_READING_LIST",
    parameters: () => ({ per_page: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["data"], ["items"]), (item) =>
        joinParts(
          first(item, ["article", "title"], ["title"]),
          first(item, ["article", "user", "name"]),
          first(item, ["article", "url"], ["url"]),
        ),
      ),
  },
  {
    id: "devto-top-today",
    providerId: "devto",
    group: "reading",
    title: "DEV this week",
    description: "Reads the most popular DEV articles from the last week.",
    operation: "DEVTO_LIST_ARTICLES",
    parameters: () => ({ top: 7, per_page: 20 }),
    items: (result) =>
      records(result, ["data", "articles"], ["articles"]).flatMap((article) => {
        const title = first(article, ["title"]);
        const url = first(article, ["url"]);
        const reactions = count(article, ["public_reactions_count"], ["positive_reactions_count"]);

        return title && url && reactions >= DEVTO_MIN_REACTIONS
          ? [
              {
                title,
                url,
                snippet: first(article, ["description"]),
                source: describeEngagement("DEV", reactions, "reactions"),
                date: first(article, ["published_at"]).slice(0, 10),
              },
            ]
          : [];
      }),
    digest: (result) =>
      lines(items(result, ["data", "articles"], ["articles"]), (article) =>
        joinParts(
          first(article, ["title"]),
          first(article, ["tags"]),
          first(article, ["user", "name"]),
          first(article, ["url"]),
        ),
      ),
  },
];
