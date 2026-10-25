import { comparableHeadline, comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";

const MIN_HEADLINE_KEY_LENGTH = 12;

export interface DiscoverLink {
  url: string;
  title: string;
}

export interface SeenDiscoverLinks {
  urls: Set<string>;
  headlines: Set<string>;
}

function headlineKey(title: string): string | null {
  const key = comparableHeadline(title);

  return key.length >= MIN_HEADLINE_KEY_LENGTH ? key : null;
}

export function collectSeenLinks(links: Iterable<DiscoverLink>): SeenDiscoverLinks {
  const seen: SeenDiscoverLinks = { urls: new Set(), headlines: new Set() };

  for (const link of links) {
    const url = comparableHttpUrl(link.url);
    const headline = headlineKey(link.title);

    if (url) {
      seen.urls.add(url);
    }

    if (headline) {
      seen.headlines.add(headline);
    }
  }

  return seen;
}

export function claimUnseenLink(seen: SeenDiscoverLinks, link: DiscoverLink): boolean {
  const url = comparableHttpUrl(link.url);
  const headline = headlineKey(link.title);

  if (!url || seen.urls.has(url) || (headline && seen.headlines.has(headline))) {
    return false;
  }

  seen.urls.add(url);

  if (headline) {
    seen.headlines.add(headline);
  }

  return true;
}
