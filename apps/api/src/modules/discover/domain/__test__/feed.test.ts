import { describe, expect, it } from "vitest";

import { discoverTopicKey } from "../edition";
import { buildDiscoverFeedGroups, fillDiscoverFeed, type DiscoverFeedGroup } from "../feed";
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
    readsByTopic: new Map(),
    limit: 30,
    createId: () => `feed_${(next += 1)}`,
  });
}

describe("fillDiscoverFeed", () => {
  it("takes one item from each topic in turn and at most two per topic", () => {
    const cards = fill([
      { topic: "Rust", lead: "You follow Rust", items: ["a", "b", "c", "d"].map((s) => item(s)) },
      { topic: "Formula 1", lead: "You follow Formula 1", items: [item("e"), item("f")] },
    ]);

    expect(cards.map((card) => (card.kind === "read" ? card.url : ""))).toEqual([
      "https://example.com/a",
      "https://example.com/e",
      "https://example.com/b",
      "https://example.com/f",
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

    expect(groups.map((group) => [group.topic, group.lead])).toEqual([
      ["Rust", "You follow Rust"],
      ["Sourdough", "What you have been into lately: Sourdough"],
      ["Today's headlines", "Today's headlines"],
      ["Reddit", "From Reddit"],
    ]);
  });
});
