import {
  DISCOVER_EDITION_RETENTION_DAYS,
  DISCOVER_LINK_RETENTION_DAYS,
} from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  parseTimestamp,
  shiftCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverFeedbackEntry } from "./feedback";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetainedLink {
  id: string;
  url: string | null;
  createdAt: string;
}

export function savedEditionIds(entries: readonly DiscoverFeedbackEntry[]): Set<string> {
  return new Set(entries.flatMap((entry) => (entry.signal === "saved" ? [entry.editionId] : [])));
}

export function openedLinkUrls(entries: readonly DiscoverFeedbackEntry[]): Set<string> {
  return new Set(
    entries.flatMap((entry) => {
      const url =
        entry.url && (entry.signal === "opened" || entry.signal === "saved")
          ? comparableHttpUrl(entry.url)
          : null;

      return url ? [url] : [];
    }),
  );
}

export function selectExpiredEditions(
  editions: readonly { id: string; date: string }[],
  kept: ReadonlySet<string>,
  today: string,
): string[] {
  const cutoff = shiftCalendarDate(today, -DISCOVER_EDITION_RETENTION_DAYS);

  return editions.flatMap((edition) =>
    edition.date < cutoff && !kept.has(edition.id) ? [edition.id] : [],
  );
}

export function selectStaleLinks(
  links: readonly RetainedLink[],
  opened: ReadonlySet<string>,
  now: number,
): string[] {
  const cutoff = now - DISCOVER_LINK_RETENTION_DAYS * DAY_MS;

  return links.flatMap((link) => {
    const url = link.url ? comparableHttpUrl(link.url) : null;

    return parseTimestamp(link.createdAt).getTime() < cutoff && !(url && opened.has(url))
      ? [link.id]
      : [];
  });
}
