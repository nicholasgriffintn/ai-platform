import { describe, expect, it } from "vitest";

import {
  decideStory,
  isInStoryWindow,
  readArticleSignals,
  type UmbrellaTerms,
} from "../clustering";

const AT = "2026-11-08T12:00:00.000Z";

const article = readArticleSignals(
  "Nvidia agrees to buy Arm in record chip deal",
  "The deal with SoftBank values the British chip designer at $40bn.",
);

describe("decideStory", () => {
  it("attaches to the closest story that shares a name", () => {
    const decision = decideStory(article, [
      {
        storyId: "story_a",
        score: 0.84,
        publishedAt: AT,
        signals: readArticleSignals("Regulators open review of Nvidia takeover", "Concerns grow."),
      },
      {
        storyId: "story_b",
        score: 0.91,
        publishedAt: AT,
        signals: readArticleSignals(
          "SoftBank sells Arm to Nvidia",
          "Japanese group confirms the sale.",
        ),
      },
    ]);

    expect(decision).toEqual({ kind: "attach", storyId: "story_b", score: 0.91 });
  });

  it("attaches on high similarity alone", () => {
    const decision = decideStory(article, [
      {
        storyId: "story_c",
        score: 0.95,
        publishedAt: AT,
        signals: readArticleSignals("Record bids in spectrum auction", "Telecoms spend heavily."),
      },
    ]);

    expect(decision).toEqual({ kind: "attach", storyId: "story_c", score: 0.95 });
  });

  it("needs a shared name in the middle band and opens below it", () => {
    const shared = {
      storyId: "story_d",
      publishedAt: AT,
      signals: readArticleSignals("Shares rise", "Investors cheer SoftBank results."),
    };
    const unrelated = {
      storyId: "story_e",
      publishedAt: AT,
      signals: readArticleSignals("Record bids in spectrum auction", "Telecoms spend heavily."),
    };

    expect(decideStory(article, [{ ...shared, score: 0.7 }])).toEqual({
      kind: "attach",
      storyId: "story_d",
      score: 0.7,
    });
    expect(decideStory(article, [{ ...unrelated, score: 0.7 }])).toEqual({ kind: "open" });
    expect(decideStory(article, [{ ...shared, score: 0.55 }])).toEqual({ kind: "open" });

    const umbrella: UmbrellaTerms = {
      names: new Set(["softbank"]),
      phrases: new Set(["softbank"]),
    };

    expect(decideStory(article, [{ ...shared, score: 0.7 }], umbrella)).toEqual({ kind: "open" });
  });

  it("widens the window to a week only for stories with three or more articles", () => {
    const fiveDaysLater = "2026-11-13T12:00:00.000Z";

    expect(isInStoryWindow({ publishedAt: AT }, fiveDaysLater, 2)).toBe(false);
    expect(isInStoryWindow({ publishedAt: AT }, fiveDaysLater, 3)).toBe(true);
  });

  it("ignores a capitalised word that only opens the sentence", () => {
    expect(readArticleSignals("Police arrest three", "").names.has("police")).toBe(false);
  });
});
