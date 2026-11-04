import type { DiscoverResponse } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { discoverCurrentBrief, discoverFeedEdition } from "./discover-feed-edition";

const instant = "2026-11-02T12:00:00Z";
const response: DiscoverResponse = {
  settings: {
    enabled: true,
    timezone: "Europe/London",
    curate: "",
    location: null,
    listen: true,
    evening: false,
    episode: "off",
    style: "watercolour",
    notify: false,
    feeds: [],
    newsCategories: [],
    sources: [],
    installationId: "routine",
    episodeCosts: null,
  },
  edition: {
    version: 1,
    id: "morning",
    revision: 1,
    date: "2026-11-02",
    timezone: "Europe/London",
    greeting: "Good morning",
    generatedAt: instant,
    interests: [],
    brief: [],
    feedback: {},
    cards: [
      {
        id: "old-story",
        kind: "read",
        topic: "AI",
        title: "Morning story",
        url: "https://example.com/story",
        source: "Example",
        summary: "The morning news",
        reason: "AI",
        sensitive: false,
      },
      {
        id: "action",
        kind: "action",
        title: "Your next step",
        detail: "An outstanding task",
        prompt: "Help me",
        reason: "Work",
        sensitive: false,
      },
    ],
  },
  editions: [],
  follows: [],
  windDownId: null,
  now: {
    context: {
      date: "2026-11-02",
      timezone: "Europe/London",
      mode: "remote",
      moment: "lunch",
      working: true,
      overridden: false,
      outbound: "08:00",
      returning: "17:30",
    },
    title: "Your lunchtime catch-up",
    observations: [],
    checkedAt: instant,
    updatedAt: instant,
    nextRefreshAt: "2026-11-02T12:15:00Z",
  },
  feed: {
    object: "list",
    data: [],
    last_id: null,
    has_more: false,
    unseenCount: 0,
    updatedAt: instant,
  },
};

describe("Discover feed and briefing merge", () => {
  it("does not restore missing live stories from the briefing when the feed becomes empty", () => {
    const edition = discoverFeedEdition(response, []);

    expect(edition?.cards.map((card) => card.id)).toEqual(["action"]);
    expect(edition?.greeting).toBe("Your lunchtime catch-up");
  });

  it("keeps the briefing available before the first live feed has arrived", () => {
    expect(discoverFeedEdition({ ...response, feed: undefined }, [])).toBeNull();
  });

  it("keeps the edition's other brief lines beside a live observation", () => {
    const weather = {
      id: "weather",
      kind: "weather" as const,
      title: "Weather in London",
      text: "9°C, broken clouds.",
      source: "OpenWeather",
      observedAt: instant,
      expiresAt: instant,
      actionable: false,
      fingerprint: "weather",
      stale: false,
    };
    const live = {
      ...response,
      now: response.now ? { ...response.now, observations: [weather] } : undefined,
    };

    const lines = discoverCurrentBrief(live, [
      { kind: "weather", label: "Weather", text: "Written this morning." },
      { kind: "waiting", label: "Nothing waiting", text: "No tasks tonight." },
      { kind: "note", label: "Yesterday", text: "Twenty minutes of exercise." },
    ]);

    expect(lines.map((line) => line.label)).toEqual([
      "Weather in London",
      "Nothing waiting",
      "Yesterday",
    ]);
  });
});
