import { DISCOVER_LIVE_LIMIT, type DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  emptyDiscoverLive,
  isDiscoverImageType,
  mergeDiscoverLiveItems,
  presentDiscoverFeed,
  type DiscoverLiveCandidate,
} from "../live";
import { describeDiscoverSourceError } from "../signal-document";

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

const topicCandidate: DiscoverLiveCandidate = {
  id: "topic_1",
  fingerprint: "topic",
  card: {
    id: "topic_card",
    kind: "topic",
    topic: "AI",
    title: "Today's angle on assistants",
    angle: "What changed today.",
    prompt: "Tell me more",
    reason: "You follow AI",
    sensitive: false,
  },
  editionId: "edition_1",
  publishedAt: null,
  observedAt: now.toISOString(),
};
const newerStories: DiscoverLiveCandidate[] = Array.from({ length: 30 }, (_, index) => ({
  ...candidate,
  id: `story_${index}`,
  fingerprint: `story_${index}`,
  card: {
    ...card,
    id: `card_${index}`,
    title: `Distinct headline ${String.fromCharCode(97 + (index % 26))} ${index} about the news`,
    url: `https://example.com/${index}`,
  },
}));

function feedWithBuriedTopic() {
  const initial = emptyDiscoverLive();

  return { ...initial, ...mergeDiscoverLiveItems(initial, [...newerStories, topicCandidate], now) };
}

const readFirstPage = (content: ReturnType<typeof feedWithBuriedTopic>) =>
  presentDiscoverFeed(content, {
    seen: new Map(),
    mutedTopics: [],
    limit: 24,
    leadWithShelf: true,
    now,
  });

function storyCandidate(index: number, title: string, source: string): DiscoverLiveCandidate {
  return {
    ...candidate,
    id: `story_${index}`,
    fingerprint: `story_${index}`,
    card: {
      id: `card_${index}`,
      kind: "read",
      topic: "AI",
      title,
      url: `https://example.com/${index}`,
      source,
      summary: "The story's details.",
      reason: "You follow AI",
      sensitive: false,
    },
  };
}

describe("describeDiscoverSourceError", () => {
  it("turns provider replies into something readable", () => {
    expect(
      describeDiscoverSourceError(
        'Composio tool execution failed: { "error": { "code": 403, "message": "you have exceeded your quota" } }',
      ),
    ).toBe("Its daily quota has run out, so it is paused until tomorrow.");
    expect(describeDiscoverSourceError('Connector API request failed (404): {"errors": "x"}')).toBe(
      "It could not find this on your account.",
    );
    expect(describeDiscoverSourceError('Composio tool execution failed: {"oops": true}')).toBe(
      "It could not be read just now.",
    );
  });
});

describe("isDiscoverImageType", () => {
  it("accepts photos and refuses anything that can carry script", () => {
    expect(isDiscoverImageType("image/jpeg")).toBe(true);
    expect(isDiscoverImageType("image/webp; charset=binary")).toBe(true);
    expect(isDiscoverImageType("image/svg+xml")).toBe(false);
    expect(isDiscoverImageType("text/html")).toBe(false);
  });
});

describe("Discover live feed", () => {
  it("does not bring back stories that aged out of a full feed", () => {
    const stories = Array.from({ length: DISCOVER_LIVE_LIMIT + 40 }, (_, index) =>
      storyCandidate(index, `Headline ${index}`, "Example"),
    );
    const initial = emptyDiscoverLive();
    const first = { ...initial, ...mergeDiscoverLiveItems(initial, stories, now) };
    const second = mergeDiscoverLiveItems(first, stories, new Date(now.getTime() + 900_000));

    expect(first.items).toHaveLength(DISCOVER_LIVE_LIMIT);
    expect(second.sequence).toBe(first.sequence);
    expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
  });

  it("keeps one card when different outlets report the same story", () => {
    const initial = emptyDiscoverLive();
    const merged = mergeDiscoverLiveItems(
      initial,
      [
        storyCandidate(
          1,
          "Binance says fake job interviews used as part of crypto hack",
          "BBC News",
        ),
        storyCandidate(
          2,
          "Binance says hackers used fake job interviews to pull off its crypto hack",
          "The Verge",
        ),
      ],
      now,
    );

    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]?.card).toMatchObject({
      alsoIn: [{ source: "BBC News", url: "https://example.com/1" }],
    });
  });

  it("ranks a page by topic weight without losing its paging position", () => {
    const stories = ["Reddit", "AI", "AI", "AI"].map((topic, index) => {
      const story = storyCandidate(index, `Headline number ${index}`, "Example");

      return { ...story, card: { ...story.card, topic } };
    });
    const initial = emptyDiscoverLive();
    const content = { ...initial, ...mergeDiscoverLiveItems(initial, stories, now) };
    const page = presentDiscoverFeed(content, {
      seen: new Map(),
      mutedTopics: [],
      limit: 3,
      weighTopic: (topic) => (topic === "AI" ? 2 : 0.5),
      now,
    });

    expect(page.data.map((item) => item.id)).toEqual(["story_1", "story_2", "story_0"]);
    expect(page.last_id).toBe("2");
    expect(page.has_more).toBe(true);
  });

  it("keeps a reply from the same outlet as a separate story", () => {
    const initial = emptyDiscoverLive();
    const merged = mergeDiscoverLiveItems(
      initial,
      [
        storyCandidate(
          1,
          "Astra can read and write weights to improve Qwen",
          "Hacker News, 969 points",
        ),
        storyCandidate(
          2,
          "The 'Astra can read and write weights to improve Qwen' post is misleading",
          "Hacker News, 961 points",
        ),
      ],
      now,
    );

    expect(merged.items).toHaveLength(2);
  });

  it("updates a reworded headline where it stands", () => {
    const initial = emptyDiscoverLive();
    const original = storyCandidate(
      1,
      "Ryanair may freeze workers' pay as fuel prices rise",
      "BBC News",
    );
    const first = { ...initial, ...mergeDiscoverLiveItems(initial, [original], now) };
    const reworded = {
      ...original,
      fingerprint: "reworded",
      card: {
        ...original.card,
        title: "Ryanair may freeze workers' pay and raise fares as fuel prices rise",
      },
    };
    const next = mergeDiscoverLiveItems(first, [reworded], now);

    expect(next.sequence).toBe(first.sequence);
    expect(next.items[0]).toMatchObject({
      revision: 1,
      fingerprint: "reworded",
      card: { title: reworded.card.title },
    });
  });

  it("keeps today's topics on the first page without losing stories across pages", () => {
    const content = feedWithBuriedTopic();
    const first = readFirstPage(content);
    const second = presentDiscoverFeed(content, {
      seen: new Map(),
      mutedTopics: [],
      after: first.last_id ?? undefined,
      limit: 24,
      leadWithShelf: true,
      now,
    });
    const ids = [...first.data, ...second.data].map((item) => item.id);

    expect(first.data[0]?.id).toBe(topicCandidate.id);
    expect(first.data).toHaveLength(24);
    expect(ids).toHaveLength(31);
    expect(new Set(ids).size).toBe(31);
  });

  it("leaves the newest-first order alone for callers that do not ask for the shelf", () => {
    const page = presentDiscoverFeed(feedWithBuriedTopic(), {
      seen: new Map(),
      mutedTopics: [],
      limit: 16,
      now,
    });

    expect(page.data.map((item) => item.id)).not.toContain(topicCandidate.id);
  });

  it.each([
    ["dismissed", { dismissed: true }],
    ["older than a day", { observedAt: "2026-10-31T12:15:00Z" }],
  ])("does not lift a %s topic above newer stories", (_label, change) => {
    const content = feedWithBuriedTopic();
    const page = readFirstPage({
      ...content,
      items: content.items.map((item) =>
        item.id === topicCandidate.id ? { ...item, ...change } : item,
      ),
    });

    expect(page.data.map((item) => item.id)).not.toContain(topicCandidate.id);
  });

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
      ...mergeDiscoverLiveItems(
        first,
        [
          {
            ...candidate,
            fingerprint: "changed",
            card: { ...card, title: "Regulators block the deal after a surprise ruling" },
          },
        ],
        now,
      ),
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

  it("keeps stale stories out of the top of the feed and retires them by publication date", () => {
    const initial = emptyDiscoverLive();
    const first = { ...initial, ...mergeDiscoverLiveItems(initial, [candidate], now) };
    const stale = {
      ...candidate,
      id: "story_stale",
      card: { ...card, title: "An older story found late" },
      publishedAt: "2026-10-31T12:00:00Z",
    };
    const next = mergeDiscoverLiveItems(
      first,
      [stale, { ...candidate, fingerprint: "changed", publishedAt: "2026-10-31T12:00:00Z" }],
      now,
    );

    expect(next.items.map((item) => item.id)).toEqual([candidate.id]);
    expect(next.items[0]).toMatchObject({ revision: 1, sequence: 1 });
    expect(next.items[0]?.expiresAt).toBe("2026-11-05T12:00:00.000Z");
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
