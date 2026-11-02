import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  emptyDiscoverLive,
  mergeDiscoverLiveItems,
  presentDiscoverFeed,
  type DiscoverLiveCandidate,
} from "../live";

const now = new Date("2026-11-02T12:15:00Z");
const card: DiscoverCard = {
  id: "card_1",
  kind: "read",
  topic: "AI",
  title: "A substantial new announcement",
  url: "https://example.com/announcement",
  source: "Example",
  summary: "The announcement's details.",
  reason: "You follow AI",
  sensitive: false,
};
const candidate: DiscoverLiveCandidate = {
  id: "story_1",
  fingerprint: "first",
  card,
  editionId: "edition_1",
  publishedAt: "2026-11-02T12:00:00Z",
  observedAt: now.toISOString(),
};

describe("Discover live feed", () => {
  it("does not turn an unchanged check into a new development", () => {
    const initial = emptyDiscoverLive();
    const first = { ...initial, ...mergeDiscoverLiveItems(initial, [candidate], now) };
    const later = new Date("2026-11-02T12:30:00Z");
    const next = mergeDiscoverLiveItems(
      first,
      [{ ...candidate, observedAt: later.toISOString() }],
      later,
    );

    expect(next.sequence).toBe(1);
    expect(next.updatedAt).toBe(now.toISOString());
    expect(next.items[0]).toMatchObject({
      revision: 1,
      firstShownAt: now.toISOString(),
      observedAt: later.toISOString(),
    });
  });

  it("marks a material revision as unseen while preserving the story identity", () => {
    const initial = emptyDiscoverLive();
    const first = { ...initial, ...mergeDiscoverLiveItems(initial, [candidate], now) };
    const content = {
      ...first,
      ...mergeDiscoverLiveItems(first, [{ ...candidate, fingerprint: "changed" }], now),
    };
    const page = presentDiscoverFeed(content, {
      seen: new Map([[candidate.id, 1]]),
      mutedTopics: [],
      limit: 24,
      now,
    });

    expect(page.unseenCount).toBe(1);
    expect(page.data[0]).toMatchObject({ id: candidate.id, revision: 2, seen: false });
  });

  it("deduplicates syndicated headlines and keeps dismissed stories dismissed", () => {
    const initial = emptyDiscoverLive();
    const first = { ...initial, ...mergeDiscoverLiveItems(initial, [candidate], now) };
    const dismissed = {
      ...first,
      items: first.items.map((item) => ({ ...item, dismissed: true })),
    };
    const next = mergeDiscoverLiveItems(
      dismissed,
      [
        { ...candidate, fingerprint: "changed" },
        {
          ...candidate,
          id: "syndicated",
          card: { ...card, id: "card_2", url: "https://other.example/story" },
        },
      ],
      now,
    );

    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ dismissed: true, revision: 1 });
  });

  it("pages without advancing exposure and excludes expired or muted items", () => {
    const initial = emptyDiscoverLive();
    const content = {
      ...initial,
      ...mergeDiscoverLiveItems(
        initial,
        [
          candidate,
          {
            ...candidate,
            id: "story_2",
            card: { ...card, title: "A different meaningful story", topic: "Football" },
          },
        ],
        now,
      ),
    };
    const first = presentDiscoverFeed(content, { seen: new Map(), mutedTopics: [], limit: 1, now });
    const second = presentDiscoverFeed(content, {
      seen: new Map(),
      mutedTopics: ["football"],
      after: first.last_id ?? undefined,
      limit: 1,
      now,
    });

    expect(first.unseenCount).toBe(2);
    expect(first.last_id).not.toBeNull();
    expect(second.data).toHaveLength(0);
    expect(
      presentDiscoverFeed(content, {
        seen: new Map(),
        mutedTopics: [],
        limit: 24,
        now: new Date("2026-11-06T12:00:00Z"),
      }).data,
    ).toHaveLength(0);
  });
});
