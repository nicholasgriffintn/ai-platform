import { describe, expect, it } from "vitest";

import { missedFlashcards, savedToRevisit } from "../resurface";

describe("resurface candidates", () => {
  it("brings back saved links after a week but not once they are stale", () => {
    const now = Date.parse("2026-10-24T08:00:00Z");
    const saved = (createdAt: string, url: string) => ({
      editionId: "edition_1",
      cardId: "card_1",
      signal: "saved" as const,
      topic: null,
      title: url,
      url,
      createdAt,
    });

    expect(
      savedToRevisit(
        [
          saved("2026-10-22T08:00:00Z", "https://example.com/too-new"),
          saved("2026-10-01T08:00:00Z", "https://example.com/ready"),
          saved("2026-06-01T08:00:00Z", "https://example.com/too-old"),
        ],
        now,
      ).map((item) => item.href),
    ).toEqual(["https://example.com/ready"]);
  });

  it("offers only flashcard sets with missed cards", () => {
    expect(
      missedFlashcards([
        { outputId: "set_1", title: "Rye starters", missed: 3 },
        { outputId: "set_2", title: "All known", missed: 0 },
      ]).map((item) => item.title),
    ).toEqual(["3 cards to revisit"]);
  });
});
