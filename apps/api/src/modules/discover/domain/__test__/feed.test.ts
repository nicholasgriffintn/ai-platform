import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { describe, expect, it } from "vitest";

import { discoverTopicKey } from "../edition";
import { buildDiscoverFeedGroups, fillDiscoverFeed, type DiscoverFeedGroup } from "../feed";

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
    seenUrls: new Set((options.seen ?? []).flatMap((url) => comparableHttpUrl(url) ?? [])),
    skipTopics: new Set((options.skip ?? []).map(discoverTopicKey)),
    limit: 30,
    createId: () => `feed_${(next += 1)}`,
  });
}

describe("fillDiscoverFeed", () => {
  it("takes one item from each topic in turn and at most three per topic", () => {
    const cards = fill([
      { topic: "Rust", lead: "You follow Rust", items: ["a", "b", "c", "d"].map((s) => item(s)) },
      { topic: "Formula 1", lead: "You follow Formula 1", items: [item("e"), item("f")] },
    ]);

    expect(cards.map((card) => (card.kind === "read" ? card.url : ""))).toEqual([
      "https://example.com/a",
      "https://example.com/e",
      "https://example.com/b",
      "https://example.com/f",
      "https://example.com/c",
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
