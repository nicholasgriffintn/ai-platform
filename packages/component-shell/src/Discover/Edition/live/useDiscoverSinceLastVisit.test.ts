import type { DiscoverFeedItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { listDiscoverFailingSources } from "./DiscoverSourceNotice.js";
import { listDiscoverNewCards, readDiscoverVisitBoundary } from "./useDiscoverSinceLastVisit.js";

function item(sequence: number, seen: boolean, kind: "read" | "topic" = "read"): DiscoverFeedItem {
  const shared = { id: `card_${sequence}`, reason: "Why", sensitive: false, topic: "AI" };

  return {
    id: `item_${sequence}`,
    revision: 1,
    sequence,
    editionId: "edition",
    observedAt: "2026-11-04T10:00:00.000Z",
    firstShownAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-04T10:00:00.000Z",
    expiresAt: "2026-11-07T10:00:00.000Z",
    seen,
    dismissed: false,
    signals: [],
    publishedAt: null,
    card:
      kind === "read"
        ? {
            ...shared,
            kind,
            title: "Story",
            url: "https://example.com/story",
            source: "Example",
            summary: "Summary",
          }
        : { ...shared, kind, title: "Topic", angle: "Angle", prompt: "Prompt" },
  };
}

describe("since you last looked", () => {
  it("treats stories after the newest one you saw as new", () => {
    const items = [item(5, false), item(4, false), item(3, true), item(2, false)];

    expect(listDiscoverNewCards(items, readDiscoverVisitBoundary(items))).toEqual(
      new Set(["card_5", "card_4"]),
    );
  });

  it("ignores shelf cards, which arrive out of step with stories", () => {
    expect(readDiscoverVisitBoundary([item(9, true, "topic"), item(4, true)])).toBe(4);
  });

  it("offers no split until you have seen something", () => {
    const items = [item(2, false), item(1, false)];

    expect(listDiscoverNewCards(items, readDiscoverVisitBoundary(items))).toBeNull();
  });

  it("stays put as stories are seen during the visit", () => {
    const boundary = readDiscoverVisitBoundary([item(3, false), item(2, true)]);

    expect(listDiscoverNewCards([item(3, true), item(2, true)], boundary)).toEqual(
      new Set(["card_3"]),
    );
  });
});

describe("listDiscoverFailingSources", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  const source = (lastReadAt: string | null, used = true) => ({
    providerId: "nasa",
    name: "NASA",
    description: "",
    connected: true,
    used,
    lastReadAt,
    lastError: "It could not be read just now.",
  });

  it("stays quiet about a one-off failure that still has fresh content", () => {
    expect(listDiscoverFailingSources([source("2026-11-05T07:00:00Z")], now)).toEqual([]);
  });

  it("warns once a source has gone a day without reading, or never read", () => {
    expect(listDiscoverFailingSources([source("2026-11-03T07:00:00Z")], now)).toHaveLength(1);
    expect(listDiscoverFailingSources([source(null)], now)).toHaveLength(1);
  });

  it("ignores sources you turned off", () => {
    expect(listDiscoverFailingSources([source(null, false)], now)).toEqual([]);
  });
});
