import { describe, expect, it } from "vitest";

import type { DiscoverFeedbackEntry } from "../feedback";
import {
  openedLinkUrls,
  savedEditionIds,
  selectExpiredEditions,
  selectStaleLinks,
} from "../retention";

function entry(
  signal: DiscoverFeedbackEntry["signal"],
  editionId: string,
  url: string | null = null,
): DiscoverFeedbackEntry {
  return {
    editionId,
    cardId: "card_1",
    signal,
    topic: null,
    title: "A card",
    url,
    createdAt: "2026-10-01T08:00:00Z",
  };
}

describe("selectExpiredEditions", () => {
  it("archives editions older than a fortnight unless a card was saved", () => {
    const kept = savedEditionIds([entry("saved", "old_saved"), entry("opened", "old_opened")]);

    expect(
      selectExpiredEditions(
        [
          { id: "recent", date: "2026-10-20" },
          { id: "edge", date: "2026-10-10" },
          { id: "old_saved", date: "2026-10-01" },
          { id: "old_opened", date: "2026-10-01" },
        ],
        kept,
        "2026-10-24",
      ),
    ).toEqual(["old_opened"]);
  });
});

describe("selectStaleLinks", () => {
  const now = Date.parse("2026-10-24T08:00:00Z");

  it("prunes links filed more than thirty days ago that were never opened", () => {
    const opened = openedLinkUrls([
      entry("opened", "edition_1", "https://example.com/rye/"),
      entry("more", "edition_1", "https://example.com/ignored"),
    ]);

    expect(
      selectStaleLinks(
        [
          { id: "fresh", url: "https://example.com/new", createdAt: "2026-10-20T08:00:00Z" },
          { id: "read", url: "http://example.com/rye", createdAt: "2026-09-01T08:00:00Z" },
          { id: "stale", url: "https://example.com/ignored", createdAt: "2026-09-01T08:00:00Z" },
        ],
        opened,
        now,
      ),
    ).toEqual(["stale"]);
  });
});
