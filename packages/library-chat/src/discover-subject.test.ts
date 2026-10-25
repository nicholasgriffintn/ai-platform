import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { discoverCardSubject, readDiscoverCardSubject } from "./discover-subject.js";

const topicCard: DiscoverCard = {
  id: "card-1",
  kind: "topic",
  topic: "Film",
  title: "Scorsese's next",
  angle: "A new film is coming.",
  prompt: "What is Scorsese making next?",
  reason: "You follow film",
  sensitive: false,
};

describe("discoverCardSubject", () => {
  it("gives each card its own subject that reads back to its edition and card", () => {
    const subject = discoverCardSubject("edition-1", topicCard);

    expect(subject.type).toBe("discover_card");
    expect(readDiscoverCardSubject(subject)).toEqual({ editionId: "edition-1", cardId: "card-1" });
  });

  it("keeps a filed read card on its source", () => {
    const card: DiscoverCard = {
      id: "card-2",
      kind: "read",
      topic: "Film",
      title: "Charli XCX and Scorsese",
      url: "https://example.com/article",
      source: "Example",
      summary: "A collaboration.",
      reason: "You follow film",
      sensitive: false,
      sourceId: "source-1",
    };

    expect(discoverCardSubject("edition-1", card)).toEqual({ type: "source", id: "source-1" });
  });

  it("rejects malformed card subjects", () => {
    expect(readDiscoverCardSubject({ type: "discover_card", id: "edition-1" })).toBeNull();
    expect(readDiscoverCardSubject({ type: "discover_card", id: ":card-1" })).toBeNull();
    expect(readDiscoverCardSubject({ type: "discover_card", id: "edition-1:" })).toBeNull();
    expect(readDiscoverCardSubject({ type: "discover_card", id: "edition-1:card:1" })).toBeNull();
    expect(readDiscoverCardSubject({ type: "output", id: "edition-1:card-1" })).toBeNull();
  });
});
