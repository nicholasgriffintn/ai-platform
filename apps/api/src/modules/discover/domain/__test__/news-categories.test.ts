import { describe, expect, it } from "vitest";

import {
  matchDiscoverNews,
  pickDiscoverHeadlines,
  type DiscoverNewsItem,
} from "../news-categories";
import { readDiscoverNewsCategoryIds } from "../settings";

function story(
  slug: string,
  category: string,
  publishedAt: string,
  title = slug,
): DiscoverNewsItem {
  return {
    title,
    url: `https://example.com/${slug}`,
    snippet: "",
    source: "Example",
    category,
    publishedAt,
  };
}

describe("pickDiscoverHeadlines", () => {
  it("takes turns across the chosen categories, newest first, and leaves out yesterday's news", () => {
    const headlines = pickDiscoverHeadlines(
      [
        story("world-old", "world", "2026-10-26T08:00:00Z"),
        story("world-1", "world", "2026-10-28T08:00:00Z"),
        story("world-2", "world", "2026-10-28T09:00:00Z"),
        story("tech-1", "technology", "2026-10-28T07:00:00Z"),
      ],
      { since: "2026-10-27T12:00:00Z", limit: 3 },
    );

    expect(headlines.map((item) => item.url.split("/").at(-1))).toEqual([
      "world-2",
      "tech-1",
      "world-1",
    ]);
  });
});

describe("matchDiscoverNews", () => {
  it("matches every word of a topic as a whole word", () => {
    const items = [
      story("gp", "sport", "2026-10-28T08:00:00Z", "Verstappen wins the Japanese Grand Prix"),
      story(
        "prix",
        "culture",
        "2026-10-28T08:00:00Z",
        "Grand prix of cinema goes to Japanese film",
      ),
      story("rusty", "technology", "2026-10-28T08:00:00Z", "Rusty pipes and old servers"),
      story("rust", "technology", "2026-10-28T08:00:00Z", "Rust 2.0 lands"),
    ];
    const urls = (topic: string) =>
      matchDiscoverNews(topic, items, { since: "2026-10-27T00:00:00Z", limit: 8 }).map((item) =>
        item.url.split("/").at(-1),
      );

    expect(urls("Japanese Grand Prix")).toEqual(["gp", "prix"]);
    expect(urls("Rust")).toEqual(["rust"]);
  });
});

describe("readDiscoverNewsCategoryIds", () => {
  it("keeps only categories Discover knows, in catalogue order", () => {
    expect(readDiscoverNewsCategoryIds(["gaming", "made-up", "world", 4])).toEqual([
      "world",
      "gaming",
    ]);
  });
});
