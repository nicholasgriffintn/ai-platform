import { isRecord, shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { first, items, lines, joinParts, listsNothing, records } from "./read";
import type { DiscoverSignal, DiscoverSignalRead } from "./types";

const NEW_RELEASE_DAYS_BACK = 30;
const NEW_RELEASE_DAYS_AHEAD = 14;
const NEW_RELEASE_LIMIT = 8;
const NEW_RELEASE_TYPES = new Set(["album", "ep", "single"]);

function topArtistNames(result: unknown): string[] {
  return records(result, ["topartists", "artist"]).flatMap((artist) => {
    const name = first(artist, ["name"]);

    return name ? [name] : [];
  });
}

function newReleaseSearchUrl(result: unknown, { date }: DiscoverSignalRead): string | null {
  const artists = topArtistNames(result).map((name) => `artist:"${name.replace(/["\\]/gu, "")}"`);

  if (artists.length === 0) {
    return null;
  }

  const window = `[${shiftCalendarDate(date, -NEW_RELEASE_DAYS_BACK)} TO ${shiftCalendarDate(date, NEW_RELEASE_DAYS_AHEAD)}]`;
  const query = new URLSearchParams({
    query: `(${artists.join(" OR ")}) AND firstreleasedate:${window}`,
    fmt: "json",
    limit: "50",
  });

  return `https://musicbrainz.org/ws/2/release-group?${query.toString()}`;
}

function newReleaseItems(result: unknown): DiscoverResearchResult[] {
  if (!isRecord(result)) {
    return [];
  }

  const followed = new Set(topArtistNames(result.listed).map((name) => name.toLowerCase()));

  return records(result.found, ["release-groups"])
    .flatMap((release) => {
      const artist = records(release, ["artist-credit"])
        .map((credit) => first(credit, ["name"]))
        .find((name) => followed.has(name.toLowerCase()));
      const kind = first(release, ["primary-type"]).toLowerCase();
      const date = first(release, ["first-release-date"]);
      const title = first(release, ["title"]);
      const id = first(release, ["id"]);

      return artist && title && id && NEW_RELEASE_TYPES.has(kind)
        ? [
            {
              title,
              url: `https://musicbrainz.org/release-group/${id}`,
              snippet: `A new ${kind === "ep" ? "EP" : kind} from ${artist}, released ${date}.`,
              source: artist,
              date,
              media: "listen" as const,
              image: `https://coverartarchive.org/release-group/${id}/front-500`,
            },
          ]
        : [];
    })
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, NEW_RELEASE_LIMIT);
}

export const LISTENING_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "lastfm-recent",
    providerId: "lastfm",
    group: "listening",
    title: "Last.fm",
    description: "Reads what you have been listening to.",
    operation: "get_recent_tracks",
    parameters: () => ({ limit: 30 }),
    digest: (result) =>
      lines(items(result, ["recenttracks", "track"]), (track) =>
        joinParts(first(track, ["artist", "#text"], ["artist", "name"]), first(track, ["name"])),
      ),
  },
  {
    id: "lastfm-top-artists",
    providerId: "lastfm",
    group: "listening",
    title: "Last.fm top artists",
    description: "Reads the artists you have played most this month.",
    operation: "get_top_artists",
    parameters: () => ({ period: "1month", limit: 10 }),
    digest: (result) =>
      lines(items(result, ["topartists", "artist"]), (artist) =>
        joinParts(
          first(artist, ["name"]),
          first(artist, ["playcount"]) && `${first(artist, ["playcount"])} plays`,
        ),
      ),
  },
  {
    id: "lastfm-new-releases",
    providerId: "lastfm",
    group: "listening",
    title: "New music from your artists",
    description: "Looks up new releases from the artists you play most.",
    operation: "get_top_artists",
    parameters: () => ({ period: "3month", limit: 15 }),
    notActivity: true,
    lookup: newReleaseSearchUrl,
    isEmpty: (result) => listsNothing(result, ["found", "release-groups"]),
    items: newReleaseItems,
    digest: () => [],
  },
  {
    id: "audiobookshelf-progress",
    providerId: "audiobookshelf",
    group: "listening",
    title: "Audiobookshelf",
    description: "Reads the audiobooks and podcasts you're part way through.",
    operation: "list_in_progress",
    parameters: () => ({}),
    digest: (result) =>
      lines(items(result, ["libraryItems"], ["items"], ["results"]), (item) =>
        joinParts(
          first(item, ["media", "metadata", "title"], ["title"]),
          first(item, ["media", "metadata", "authorName"], ["author"]),
        ),
      ),
  },
];
