import { describe, expect, it } from "vitest";

import { mergeSearchSources, selectRelevantSources } from "../source-ranking";

function ranked(scores: number[]) {
  return scores.map((score, index) => ({ document: { url: `https://e/${index}` }, score }));
}

describe("selectRelevantSources", () => {
  it("drops sources the model found irrelevant", () => {
    const result = selectRelevantSources(ranked([0.9, 0.7, 0.5, 0.02, 0.01]));

    expect(result.sources).toHaveLength(3);
    expect(result.droppedCount).toBe(2);
  });

  it("always keeps a usable floor of sources even when every score is low", () => {
    const result = selectRelevantSources(ranked([0.04, 0.03, 0.02, 0.01]));

    expect(result.sources).toHaveLength(3);
    expect(result.droppedCount).toBe(1);
  });
});

describe("mergeSearchSources", () => {
  it("keeps the first result for a url and drops later duplicates across searches", () => {
    const merged = mergeSearchSources([
      [{ url: "https://a", content: "first" }],
      [
        { url: "https://A", content: "duplicate with different case" },
        { url: "https://b", content: "second" },
      ],
    ]);

    expect(merged).toEqual([
      { url: "https://a", content: "first" },
      { url: "https://b", content: "second" },
    ]);
  });
});
