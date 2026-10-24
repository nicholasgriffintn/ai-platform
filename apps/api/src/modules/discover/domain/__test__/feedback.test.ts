import { describe, expect, it } from "vitest";

import {
  collectCardSignals,
  summariseDiscoverFeedback,
  type DiscoverFeedbackEntry,
} from "../feedback";

function entry(
  overrides: Partial<DiscoverFeedbackEntry> & Pick<DiscoverFeedbackEntry, "signal" | "createdAt">,
): DiscoverFeedbackEntry {
  return {
    editionId: "edition_1",
    cardId: "card_1",
    topic: "Formula 1",
    title: "Brazil sprint",
    url: null,
    ...overrides,
  };
}

describe("summariseDiscoverFeedback", () => {
  it("lets the latest preference for a topic win, across editions and casing", () => {
    const summary = summariseDiscoverFeedback([
      entry({ signal: "more", createdAt: "2026-10-23T08:00:00Z", editionId: "edition_0" }),
      entry({ signal: "hide", createdAt: "2026-10-24T08:00:00Z", topic: "formula 1" }),
      entry({ signal: "less", createdAt: "2026-10-24T09:00:00Z", topic: "Sourdough" }),
    ]);

    expect(summary.hiddenTopics).toEqual(["formula 1"]);
    expect(summary.moreTopics).toEqual([]);
    expect(summary.lessTopics).toEqual(["Sourdough"]);
  });

  it("keeps saved cards apart from topic preferences", () => {
    const summary = summariseDiscoverFeedback([
      entry({ signal: "saved", createdAt: "2026-10-24T08:00:00Z", topic: null, title: "Rye" }),
    ]);

    expect(summary.saved).toEqual([{ title: "Rye", url: null }]);
    expect(summary.hiddenTopics).toEqual([]);
  });
});

describe("collectCardSignals", () => {
  it("replaces one preference with the next but keeps saved and opened", () => {
    const signals = collectCardSignals(
      [
        entry({ signal: "opened", createdAt: "2026-10-24T08:00:00Z" }),
        entry({ signal: "more", createdAt: "2026-10-24T08:01:00Z" }),
        entry({ signal: "saved", createdAt: "2026-10-24T08:02:00Z" }),
        entry({ signal: "less", createdAt: "2026-10-24T08:03:00Z" }),
        entry({ signal: "more", createdAt: "2026-10-24T08:04:00Z", editionId: "edition_2" }),
      ],
      "edition_1",
    );

    expect(signals).toEqual({ card_1: ["opened", "saved", "less"] });
  });
});
