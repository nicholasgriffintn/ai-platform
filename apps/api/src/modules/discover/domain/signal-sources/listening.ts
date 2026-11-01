import { first, items, lines, joinParts } from "./read";
import type { DiscoverSignal } from "./types";

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
