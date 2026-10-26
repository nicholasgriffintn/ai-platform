import { discoverEditionContentSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  addResearchedReads,
  chooseBriefingTopics,
  describeBriefingLeads,
  planEditionResearch,
} from "../briefing";

const edition = discoverEditionContentSchema.parse({
  version: 1,
  date: "2026-10-26",
  timezone: "Europe/London",
  greeting: "Morning",
  interests: [
    { topic: "Formula 1", reason: "You follow it." },
    { topic: "Sourdough", reason: "Your notebook." },
  ],
  brief: [],
  cards: [
    {
      id: "read_1",
      kind: "read",
      topic: "Rust",
      title: "Rust 2.0 lands in nightly",
      url: "https://example.com/rust",
      source: "Example",
      summary: "The compiler team shipped it.",
      reason: "You follow Rust",
    },
    {
      id: "topic_1",
      kind: "topic",
      topic: "formula 1",
      title: "The Brazil sprint",
      angle: "A wet weekend.",
      prompt: "Tell me about Brazil.",
      reason: "Three chats.",
    },
    {
      id: "read_2",
      kind: "read",
      topic: "Formula 1",
      title: "Verstappen takes pole in the rain",
      url: "https://example.com/f1",
      source: "Example",
      summary: "Qualifying was red-flagged twice.",
      reason: "You follow Formula 1",
    },
  ],
  generatedAt: "2026-10-26T07:00:00.000Z",
});

describe("chooseBriefingTopics", () => {
  it("researches the episode's topic first, then the edition's topics, interests and reads once each", () => {
    expect(chooseBriefingTopics(edition, "Cycling")).toEqual([
      "Cycling",
      "formula 1",
      "Sourdough",
      "Rust",
    ]);
    expect(chooseBriefingTopics(edition, null, 2)).toEqual(["formula 1", "Sourdough"]);
  });
});

describe("planEditionResearch", () => {
  it("researches only the episode's topic when The Perch is not being made, since the episode budgets one briefing", () => {
    expect(planEditionResearch({ edition, listen: false, episodeTopic: "Cycling" })).toEqual([
      "Cycling",
    ]);
    expect(planEditionResearch({ edition, listen: false, episodeTopic: null })).toEqual([]);
    expect(planEditionResearch({ edition, listen: true, episodeTopic: "Cycling" })).toHaveLength(4);
  });
});

describe("describeBriefingLeads", () => {
  it("digs into the edition's angle and the stories it links on the topic", () => {
    expect(describeBriefingLeads(edition, "Formula 1").map((lead) => lead.title)).toEqual([
      "The Brazil sprint",
      "Verstappen takes pole in the rain",
    ]);
  });
});

describe("addResearchedReads", () => {
  it("adds pages found while researching after the topic's reads, once each and with their filed copy", () => {
    const found = (slug: string, title: string) => ({
      title,
      url: `https://news.example/${slug}`,
      snippet: `About ${slug}.`,
      source: "News Example",
      date: "2026-10-26",
      sourceId: `source_${slug}`,
    });
    let next = 0;
    const updated = addResearchedReads({
      edition,
      topic: "Formula 1",
      found: [
        found("tyres", "Why the wet tyres failed at Interlagos"),
        found("seen", "A story from yesterday's edition"),
        { ...found("dupe", "Verstappen takes pole in the rain"), url: "https://example.com/f1" },
      ],
      seenLinks: [{ url: "https://news.example/seen", title: "" }],
      createId: () => `research_${(next += 1)}`,
    });

    expect(updated.cards.map((card) => card.id)).toEqual([
      "read_1",
      "topic_1",
      "read_2",
      "research_1",
    ]);
    expect(updated.cards[3]).toMatchObject({
      kind: "read",
      topic: "Formula 1",
      url: "https://news.example/tyres",
      sourceId: "source_tyres",
    });
  });
});
