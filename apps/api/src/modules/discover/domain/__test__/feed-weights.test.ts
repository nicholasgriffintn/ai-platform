import { describe, expect, it } from "vitest";

import { summariseDiscoverFeedPreferences, weighDiscoverFeedTopic } from "../feed-weights";
import type { DiscoverFeedbackEntry } from "../feedback";

const since = Date.parse("2026-11-01T00:00:00Z");

function feedback(topic: string, signal: DiscoverFeedbackEntry["signal"]): DiscoverFeedbackEntry {
  return {
    editionId: "edition",
    cardId: `${topic}-${signal}`,
    signal,
    topic,
    title: topic,
    url: null,
    createdAt: "2026-11-03T00:00:00Z",
  };
}

describe("weighDiscoverFeedTopic", () => {
  const exposure = { topics: new Map([["reddit", 30]]), since };

  it("lowers a topic that is shown often and never opened", () => {
    const preferences = summariseDiscoverFeedPreferences([], exposure);

    expect(weighDiscoverFeedTopic("Reddit", preferences)).toBe(0.5);
  });

  it("keeps a topic that gets opened", () => {
    const preferences = summariseDiscoverFeedPreferences(
      [feedback("Reddit", "opened"), feedback("Reddit", "saved")],
      exposure,
    );

    expect(weighDiscoverFeedTopic("Reddit", preferences)).toBeGreaterThanOrEqual(1);
  });

  it("does not judge a topic before it has been shown enough", () => {
    const preferences = summariseDiscoverFeedPreferences([], {
      topics: new Map([["reddit", 5]]),
      since,
    });

    expect(weighDiscoverFeedTopic("Reddit", preferences)).toBe(1);
  });

  it("lets asking for more override being ignored", () => {
    const preferences = summariseDiscoverFeedPreferences([feedback("Reddit", "more")], exposure);

    expect(weighDiscoverFeedTopic("Reddit", preferences)).toBe(2);
  });
});
