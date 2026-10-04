import { describe, expect, it } from "vitest";

import { selectRelevantSources, sourceText } from "../source-ranking";

function ranked(scores: number[]) {
  return scores.map((score, index) => ({ document: { url: `https://e/${index}` }, score }));
}

describe("sourceText", () => {
  it("prefers full content but falls back to the snippet", () => {
    expect(sourceText({ title: "T", content: "body" })).toBe("T\n\nbody");
    expect(sourceText({ title: "T", snippet: "snip" })).toBe("T\n\nsnip");
    expect(sourceText({ content: "body" })).toBe("body");
  });
});

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

  it("keeps everything when every source is relevant", () => {
    const result = selectRelevantSources(ranked([0.9, 0.8, 0.7, 0.6]));

    expect(result.sources).toHaveLength(4);
    expect(result.droppedCount).toBe(0);
  });
});
