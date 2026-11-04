import { hashSeed, isoDaysBefore, readUrlHost } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { first, joinParts, lines, records } from "./read";
import type { DiscoverPublicSignal } from "./types";

export const DISCOVER_FEED_PROVIDER_ID = "feeds";

const FEED_SIGNAL_PREFIX = "feed-";
const FEED_ITEM_DAYS = 14;

export function isDiscoverFeedSignalId(id: string): boolean {
  return id.startsWith(FEED_SIGNAL_PREFIX);
}

function describeFeedHost(url: string): string {
  const host = readUrlHost(url);

  return /(^|\.)patreon\.com$/u.test(host) ? "Patreon" : host;
}

function feedEntries(result: unknown): Record<string, unknown>[] {
  return records(result, ["items"]);
}

function feedItems(result: unknown, url: string, now: Date): DiscoverResearchResult[] {
  const since = isoDaysBefore(now, FEED_ITEM_DAYS);
  const source = first(result, ["title"]) || describeFeedHost(url);

  return feedEntries(result).flatMap((entry) => {
    const title = first(entry, ["title"]);
    const link = first(entry, ["url"]);
    const publishedAt = first(entry, ["publishedAt"]);

    return title && link && (!publishedAt || publishedAt >= since)
      ? [
          {
            title,
            url: link,
            snippet: first(entry, ["summary"]).slice(0, 400),
            source,
            date: publishedAt.slice(0, 10),
            image: first(entry, ["imageUrl"]) || undefined,
          },
        ]
      : [];
  });
}

export function createDiscoverFeedSignal(url: string): DiscoverPublicSignal {
  return {
    kind: "public",
    id: `${FEED_SIGNAL_PREFIX}${hashSeed(url).toString(36)}`,
    providerId: DISCOVER_FEED_PROVIDER_ID,
    group: "reading",
    title: "Your feeds",
    description: "Reads the feeds you follow, such as blogs, newsletters and Patreon creators.",
    format: "feed",
    url: () => url,
    items: (result, { now }) => feedItems(result, url, now),
    digest: (result) =>
      lines(feedEntries(result), (entry) =>
        joinParts(first(result, ["title"]), first(entry, ["title"]), first(entry, ["url"])),
      ),
  };
}
