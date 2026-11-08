import type { DiscoverCard, StorySummary } from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { describe, expect, it } from "vitest";

import { foldDiscoverStoryCards } from "../story-cards";

function readCard(id: string, topic: string, url: string, source: string): DiscoverCard {
  return {
    id,
    kind: "read",
    topic,
    title: `${source} on ${topic}`,
    url,
    source,
    summary: "A summary.",
    reason: "You asked about it.",
    sensitive: false,
  };
}

function topicCard(id: string, topic: string): DiscoverCard {
  return {
    id,
    kind: "topic",
    topic,
    title: topic,
    angle: "What is new.",
    prompt: "Tell me more.",
    reason: "You follow it.",
    sensitive: false,
  };
}

function story(id: string, outletCount: number): StorySummary {
  return {
    id,
    slug: id,
    title: `Story ${id}`,
    status: "open",
    openedAt: "2026-11-01T00:00:00.000Z",
    lastArticleAt: "2026-11-08T00:00:00.000Z",
    articleCount: outletCount,
    outletCount,
    topicKey: null,
  };
}

const stories = new Map<string, StorySummary>();

for (const [url, summary] of [
  ["https://bbc.example/budget", story("budget", 5)],
  ["https://guardian.example/budget", story("budget", 5)],
  ["https://ft.example/rates", story("rates", 2)],
] as const) {
  stories.set(comparableHttpUrl(url) ?? url, summary);
}

describe("foldDiscoverStoryCards", () => {
  it("keeps one card per story and folds the other outlets into it", () => {
    const cards = foldDiscoverStoryCards(
      [
        readCard("a", "Economy", "https://bbc.example/budget/#top", "BBC"),
        readCard("b", "Economy", "https://guardian.example/budget", "Guardian"),
        readCard("c", "Gardening", "https://blog.example/roses", "Blog"),
      ],
      stories,
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      id: "a",
      storyId: "budget",
      outletCount: 5,
      alsoIn: [{ source: "Guardian", url: "https://guardian.example/budget" }],
    });
    expect(cards[1]).not.toHaveProperty("storyId");
  });

  it("keys a topic by the story most of its articles belong to, and by text when none has one", () => {
    const cards = foldDiscoverStoryCards(
      [
        topicCard("t1", "Economy"),
        topicCard("t2", "Gardening"),
        readCard("a", "economy", "https://ft.example/rates", "FT"),
        readCard("b", "Economy", "https://bbc.example/budget", "BBC"),
        readCard("c", "ECONOMY ", "https://guardian.example/budget", "Guardian"),
        readCard("d", "Gardening", "https://blog.example/roses", "Blog"),
      ],
      stories,
    );

    expect(cards.find((card) => card.id === "t1")).toMatchObject({ storyId: "budget" });
    expect(cards.find((card) => card.id === "t2")).not.toHaveProperty("storyId");
  });
});
