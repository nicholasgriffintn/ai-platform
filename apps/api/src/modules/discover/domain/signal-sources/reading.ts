import { isoDaysBefore } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { first, items, joinParts, lines, records } from "./read";
import type { DiscoverSignal } from "./types";

const READER_FEED_DAYS = 3;

function readerPublishedDate(document: Record<string, unknown>): string {
  const published = first(document, ["published_date"]);

  if (/^\d+$/u.test(published)) {
    return new Date(Number(published)).toISOString().slice(0, 10);
  }

  return published.slice(0, 10);
}

function readerFeedItems(result: unknown): DiscoverResearchResult[] {
  return records(result, ["results"]).flatMap((document) => {
    const title = first(document, ["title"]);
    const url = first(document, ["source_url"], ["url"]);

    return title && url
      ? [
          {
            title,
            url,
            snippet: first(document, ["summary"]).slice(0, 400),
            source: first(document, ["site_name"], ["author"]) || "Readwise Reader",
            date: readerPublishedDate(document),
          },
        ]
      : [];
  });
}

export const READING_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "readwise-highlights",
    providerId: "readwise",
    group: "reading",
    title: "Readwise",
    description: "Reads your recent highlights and Reader queue.",
    operation: "list_highlights",
    parameters: ({ now }) => ({ updatedAfter: isoDaysBefore(now, 7) }),
    digest: (result) =>
      lines(items(result, ["results"]), (book) =>
        joinParts(
          first(book, ["title"]),
          first(book, ["author"]),
          first(book, ["highlights", 0, "text"]).slice(0, 140),
        ),
      ),
  },
  {
    id: "readwise-reader",
    providerId: "readwise",
    group: "reading",
    title: "Readwise Reader",
    description: "Reads what is waiting in your Reader queue.",
    operation: "list_reader_documents",
    parameters: ({ now }) => ({ location: "later", updatedAfter: isoDaysBefore(now, 14) }),
    digest: (result) =>
      lines(items(result, ["results"]), (document) =>
        joinParts(first(document, ["title"]), first(document, ["site_name"], ["author"])),
      ),
  },
  {
    id: "readwise-feed",
    providerId: "readwise",
    group: "reading",
    title: "Reader feed",
    description: "Reads the newest posts in your Readwise Reader feed.",
    operation: "list_reader_documents",
    parameters: ({ now }) => ({
      location: "feed",
      updatedAfter: isoDaysBefore(now, READER_FEED_DAYS),
    }),
    items: (result) => readerFeedItems(result),
    digest: (result) =>
      lines(items(result, ["results"]), (document) =>
        joinParts(first(document, ["title"]), first(document, ["site_name"], ["author"])),
      ),
  },
  {
    id: "hardcover-reading",
    providerId: "hardcover",
    group: "reading",
    title: "Hardcover",
    description: "Reads the books you are reading.",
    operation: "list_books",
    parameters: () => ({ status: "currently_reading", limit: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "me", 0, "user_books"], ["books"], ["results"]), (book) =>
        joinParts(
          first(book, ["book", "title"], ["title"]),
          first(book, ["book", "contributions", 0, "author", "name"], ["author"]),
        ),
      ),
  },
  {
    id: "raindrop-bookmarks",
    providerId: "raindrop",
    group: "reading",
    title: "Raindrop.io",
    description: "Reads the bookmarks you keep adding.",
    operation: "RAINDROP_LIST_BOOKMARKS",
    parameters: () => ({ collection_id: 0, sort: "-created", per_page: 25 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (bookmark) =>
        joinParts(
          first(bookmark, ["title"]),
          first(bookmark, ["domain"]),
          first(bookmark, ["link"]),
        ),
      ),
  },
];
