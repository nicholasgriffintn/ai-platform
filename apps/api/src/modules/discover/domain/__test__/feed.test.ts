import { describe, expect, it } from "vitest";

import { discoverTopicKey } from "../edition";
import { buildDiscoverFeedGroups, fillDiscoverFeed, type DiscoverFeedGroup } from "../feed";
import { summariseDiscoverFeedPreferences } from "../feed-weights";
import { collectSeenLinks } from "../links";

function item(slug: string, source = "Example") {
  return {
    title: `Story ${slug}`,
    url: `https://example.com/${slug}`,
    snippet: `About ${slug}`,
    source,
    date: "2026-10-25",
  };
}

function fill(groups: DiscoverFeedGroup[], options: { seen?: string[]; skip?: string[] } = {}) {
  let next = 0;

  return fillDiscoverFeed({
    groups,
    seen: collectSeenLinks((options.seen ?? []).map((url) => ({ url, title: "" }))),
    skipTopics: new Set((options.skip ?? []).map(discoverTopicKey)),
    limit: 100,
    createId: () => `feed_${(next += 1)}`,
  });
}

describe("fillDiscoverFeed", () => {
  it("keeps every useful link, one topic at a time, with the topics the edition covers first", () => {
    const cards = fill([
      {
        topic: "Rust",
        lead: "You follow Rust",
        items: ["a", "b", "c", "d"].map((s) => item(s)),
        spoken: true,
      },
      { topic: "Reddit", lead: "From Reddit", items: [item("p"), item("q")] },
      { topic: "Formula 1", lead: "You follow Formula 1", items: [item("e")], spoken: true },
    ]);

    expect(cards.map((card) => (card.kind === "read" ? card.url : ""))).toEqual([
      "https://example.com/a",
      "https://example.com/e",
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/d",
      "https://example.com/p",
      "https://example.com/q",
    ]);
  });

  it("puts the newest story first and drops tracked or syndicated copies", () => {
    const cards = fill([
      {
        topic: "Rust",
        lead: "You follow Rust",
        items: [
          { ...item("old"), date: "2026-10-20" },
          { ...item("new"), title: "Rust 2.0 lands in nightly" },
          { ...item("new"), url: "https://www.example.com/new/?utm_source=feed" },
          {
            ...item("copy"),
            title: "Rust 2.0 lands in nightly | Other Site",
            url: "https://other.example/rust",
          },
        ],
      },
    ]);

    expect(cards.map((card) => (card.kind === "read" ? card.url : ""))).toEqual([
      "https://example.com/new",
      "https://example.com/old",
    ]);
  });

  it("gives sources you asked for more of extra cards each round and sources you want less of fewer", () => {
    const cards = fill([
      {
        topic: "Hacker News",
        lead: "From HN",
        items: ["h1", "h2", "h3", "h4"].map((s) => item(s)),
        weight: 2,
        ranked: true,
      },
      {
        topic: "DEV",
        lead: "From DEV",
        items: ["d1", "d2", "d3"].map((s) => item(s)),
        weight: 0.5,
        ranked: true,
      },
    ]);

    expect(cards.map((card) => (card.kind === "read" ? card.url.split("/").at(-1) : ""))).toEqual([
      "h1",
      "h2",
      "h3",
      "h4",
      "d1",
      "d2",
      "d3",
    ]);
  });

  it("turns videos and podcast episodes into watch and listen cards", () => {
    const cards = fill([
      {
        topic: "YouTube new videos",
        lead: "From YouTube new videos",
        items: [
          { ...item("video"), media: "watch" as const },
          { ...item("episode"), media: "listen" as const },
        ],
        ranked: true,
      },
    ]);

    expect(cards.map((card) => card.kind)).toEqual(["watch", "listen"]);
  });

  it("leaves out an item that would not make a valid card, such as a plain http link", () => {
    const cards = fill([
      {
        topic: "Linkin Park",
        lead: "What you have been into lately: Linkin Park",
        items: [{ ...item("band"), url: "http://linkinpark.de/" }, item("tour")],
      },
    ]);

    expect(cards.map((card) => (card.kind === "read" ? card.url : ""))).toEqual([
      "https://example.com/tour",
    ]);
  });

  it("skips links already shown and topics that are hidden", () => {
    const cards = fill(
      [
        { topic: "Rust", lead: "You follow Rust", items: [item("a"), item("b")] },
        { topic: "Crypto", lead: "Lately: Crypto", items: [item("c")] },
      ],
      { seen: ["https://example.com/a"], skip: ["crypto"] },
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      kind: "read",
      url: "https://example.com/b",
      topic: "Rust",
      source: "Example",
      reason: "You follow Rust. Example, 2026-10-25",
    });
  });
});

describe("buildDiscoverFeedGroups", () => {
  it("weights service feeds by more, less and how often their cards get opened", () => {
    const feedback = (signal: "more" | "less" | "opened", topic: string, cardId: string) => ({
      editionId: "e1",
      cardId,
      signal,
      topic,
      title: "",
      url: null,
      createdAt: "2026-10-30T10:00:00Z",
    });
    const groups = buildDiscoverFeedGroups({
      research: [],
      signals: [
        { title: "DEV this week", items: [item("d")] },
        { title: "Hacker News", items: [item("h")] },
        { title: "Lobsters", items: [item("l")] },
      ],
      headlinesTopic: "Today's headlines",
      followedTopics: new Set(),
      curate: "",
      interestOrder: [],
      preferences: summariseDiscoverFeedPreferences([
        feedback("less", "DEV this week", "c1"),
        feedback("more", "Hacker News", "c2"),
        feedback("opened", "Lobsters", "c3"),
        feedback("opened", "Lobsters", "c4"),
      ]),
    });

    expect(groups.map((group) => [group.topic, group.weight])).toEqual([
      ["Hacker News", 2],
      ["Lobsters", 1.2],
      ["DEV this week", 0.5],
    ]);
  });

  it("puts followed topics first, then today's interests, headlines, then service feeds", () => {
    const groups = buildDiscoverFeedGroups({
      research: [
        { topic: "Today's headlines", results: [item("h")] },
        { topic: "Sourdough", results: [item("s")] },
        { topic: "Rust", results: [item("r")] },
        { topic: "Empty", results: [] },
      ],
      signals: [{ title: "Reddit", items: [item("p", "r/rust, 120 points")] }],
      headlinesTopic: "Today's headlines",
      followedTopics: new Set([discoverTopicKey("Rust")]),
      curate: "",
      interestOrder: ["Sourdough"],
    });

    expect(groups.map((group) => [group.topic, group.lead, group.spoken ?? false])).toEqual([
      ["Rust", "You follow Rust", true],
      ["Sourdough", "What you have been into lately: Sourdough", true],
      ["Today's headlines", "Today's headlines", false],
      ["Reddit", "From Reddit", false],
    ]);
  });
});
