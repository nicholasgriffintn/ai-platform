import { composeDiscoverEditionInputSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildDiscoverEdition, discoverTopicKey, listEditionUrls } from "../edition";
import type { DiscoverFeedGroup } from "../feed";

function readCard(topic: string, url: string) {
  return {
    kind: "read" as const,
    topic,
    title: `About ${topic}`,
    url,
    source: "Example",
    summary: "A summary.",
    reason: "You asked about it.",
  };
}

const draft = composeDiscoverEditionInputSchema.parse({
  greeting: "Good morning",
  interests: [
    { topic: "Formula 1", reason: "Three chats this week." },
    { topic: "Sourdough", reason: "Your notebook." },
  ],
  brief: [
    {
      kind: "on_this_day",
      label: "On this day",
      text: "1946, the first photo of Earth from space.",
    },
  ],
  cards: [
    readCard("Formula 1", "https://www.example.com/f1/"),
    readCard("Sourdough", "https://example.com/rye-starters"),
    readCard("Sourdough", "https://example.com/rye-starters#comments"),
    {
      kind: "topic",
      topic: "formula 1",
      title: "Brazil",
      angle: "Sprint weekend.",
      prompt: "Tell me about Brazil.",
      reason: "Three chats.",
    },
    { kind: "check_in", question: "How did the interview go?", reason: "You mentioned it." },
  ],
});

const sensitiveDraft = composeDiscoverEditionInputSchema.parse({
  greeting: "Good morning",
  interests: [
    { topic: "Sourdough", reason: "Your notebook." },
    { topic: "Debt repayment", reason: "A chat on Tuesday.", sensitive: true },
  ],
  brief: [],
  cards: [
    { ...readCard("Debt repayment", "https://example.com/debt"), sensitive: true },
    {
      kind: "check_in",
      question: "How is the new medication going?",
      reason: "You mentioned it.",
      sensitive: true,
    },
    readCard("Sourdough", "https://example.com/rye"),
  ],
});

function build(
  hiddenTopics: string[],
  recentUrls: string[],
  options: {
    input?: typeof draft;
    followed?: string[];
    curate?: string;
    resurface?: string[];
    feed?: DiscoverFeedGroup[];
  } = {},
) {
  let next = 0;

  return buildDiscoverEdition({
    draft: options.input ?? draft,
    followedTopics: new Set((options.followed ?? []).map(discoverTopicKey)),
    curate: options.curate ?? "",
    resurfaceHrefs: new Set(options.resurface ?? []),
    date: "2026-10-24",
    timezone: "Europe/London",
    generatedAt: "2026-10-24T06:00:00.000Z",
    hiddenTopics: new Set(hiddenTopics.map(discoverTopicKey)),
    recentUrls: listEditionUrls([
      {
        version: 1,
        date: "2026-10-23",
        timezone: "Europe/London",
        greeting: "Hello",
        interests: [],
        brief: [],
        cards: recentUrls.map((url, index) => ({
          ...readCard("Old", url),
          id: `old_${index}`,
          sensitive: false,
        })),
        generatedAt: "2026-10-23T06:00:00.000Z",
      },
    ]),
    feed: options.feed ?? [],
    createId: () => `card_${(next += 1)}`,
  });
}

describe("buildDiscoverEdition", () => {
  it("drops every card and interest on a hidden topic, whatever its casing", () => {
    const edition = build(["FORMULA 1"], []);

    expect(edition.interests.map((interest) => interest.topic)).toEqual(["Sourdough"]);
    expect(edition.cards.map((card) => card.kind)).toEqual(["read", "check_in"]);
  });

  it("fills the feed under the model's cards without repeating its links or hidden topics", () => {
    const edition = build(["Formula 1"], [], {
      feed: [
        {
          topic: "Sourdough",
          lead: "You follow Sourdough",
          items: [
            { title: "Same", url: "https://example.com/rye-starters", snippet: "" },
            { title: "Crumb", url: "https://example.com/crumb", snippet: "Open crumb." },
          ],
        },
        {
          topic: "Formula 1",
          lead: "You follow Formula 1",
          items: [{ title: "Grid", url: "https://example.com/grid", snippet: "" }],
        },
      ],
    });

    expect(edition.cards.flatMap((card) => (card.kind === "read" ? [card.url] : []))).toEqual([
      "https://example.com/rye-starters",
      "https://example.com/crumb",
    ]);
  });

  it("leaves out links shown recently or repeated within the edition", () => {
    const edition = build([], ["http://example.com/f1"]);

    expect(edition.cards.flatMap((card) => (card.kind === "read" ? [card.url] : []))).toEqual([
      "https://example.com/rye-starters",
    ]);
  });

  it("never infers health, sexuality, religion, politics or money", () => {
    const edition = build([], [], { input: sensitiveDraft });

    expect(edition.interests.map((interest) => interest.topic)).toEqual(["Sourdough"]);
    expect(edition.cards.map((card) => card.kind)).toEqual(["read"]);
  });

  it("keeps a sensitive topic the person follows or asked for", () => {
    const followed = build([], [], { input: sensitiveDraft, followed: ["debt repayment"] });
    const asked = build([], [], { input: sensitiveDraft, curate: "Anything on debt repayment" });

    expect(followed.interests.map((interest) => interest.topic)).toContain("Debt repayment");
    expect(asked.cards.filter((card) => card.kind === "read")).toHaveLength(2);
    expect(asked.cards.some((card) => card.kind === "check_in")).toBe(false);
  });

  it("keeps a resurface card only when it links to something worth resurfacing", () => {
    const input = composeDiscoverEditionInputSchema.parse({
      greeting: "Good morning",
      interests: [{ topic: "Sourdough", reason: "Your notebook." }],
      brief: [],
      cards: [
        {
          kind: "resurface",
          title: "3 cards to revisit",
          detail: "Rye starters",
          href: "/chat/files/made/flashcards_1",
          reason: "You missed them last week.",
        },
        {
          kind: "resurface",
          title: "A made-up link",
          detail: "Not on the list",
          href: "/chat/files/made/invented",
          reason: "Made up.",
        },
      ],
    });
    const edition = build([], [], { input, resurface: ["/chat/files/made/flashcards_1"] });

    expect(edition.cards.map((card) => (card.kind === "resurface" ? card.href : null))).toEqual([
      "/chat/files/made/flashcards_1",
    ]);
  });

  it("gives each kept card its own id", () => {
    const edition = build([], []);

    expect(edition.cards.map((card) => card.id)).toEqual(["card_1", "card_2", "card_3", "card_4"]);
  });
});
