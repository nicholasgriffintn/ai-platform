import { describe, expect, it } from "vitest";

import type { DiscoverFeedbackEntry } from "../feedback";
import { savedEditionIds, selectExpiredEditions } from "../retention";

function entry(
  signal: DiscoverFeedbackEntry["signal"],
  editionId: string,
  url: string | null = null,
): DiscoverFeedbackEntry {
  return {
    editionId,
    cardId: "card_1",
    signal,
    topic: null,
    title: "A card",
    url,
    createdAt: "2026-10-01T08:00:00Z",
  };
}

describe("selectExpiredEditions", () => {
  it("archives editions older than a fortnight unless a card was saved", () => {
    const kept = savedEditionIds([entry("saved", "old_saved"), entry("opened", "old_opened")]);

    expect(
      selectExpiredEditions(
        [
          { id: "recent", date: "2026-10-20" },
          { id: "edge", date: "2026-10-10" },
          { id: "old_saved", date: "2026-10-01" },
          { id: "old_opened", date: "2026-10-01" },
        ],
        kept,
        "2026-10-24",
      ),
    ).toEqual(["old_opened"]);
  });
});
