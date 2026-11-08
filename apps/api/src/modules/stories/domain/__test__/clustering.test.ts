import { describe, expect, it } from "vitest";

import { decideStory, readArticleSignals } from "../clustering";

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
        signals: readArticleSignals("Regulators open review of Nvidia takeover", "Concerns grow."),
      },
      {
        storyId: "story_b",
        score: 0.91,
        signals: readArticleSignals(
          "SoftBank sells Arm to Nvidia",
          "Japanese group confirms the sale.",
        ),
      },
    ]);

    expect(decision).toEqual({ kind: "attach", storyId: "story_b", score: 0.91 });
  });

  it("opens a story when a similar headline shares no entity or phrases", () => {
    const decision = decideStory(article, [
      {
        storyId: "story_c",
        score: 0.95,
        signals: readArticleSignals("Record bids in spectrum auction", "Telecoms spend heavily."),
      },
    ]);

    expect(decision).toEqual({ kind: "open" });
  });

  it("opens a story when overlap exists but similarity is below the threshold", () => {
    const decision = decideStory(article, [
      {
        storyId: "story_d",
        score: 0.7,
        signals: readArticleSignals("Nvidia shares rise", "Investors cheer results."),
      },
    ]);

    expect(decision).toEqual({ kind: "open" });
  });

  it("ignores a capitalised word that only opens the sentence", () => {
    expect(readArticleSignals("Police arrest three", "").names.has("police")).toBe(false);
  });
});
