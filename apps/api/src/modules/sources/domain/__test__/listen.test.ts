import { describe, expect, it } from "vitest";

import { buildListenPassages, canListenToSource, LISTEN_PASSAGE_CHARACTERS } from "../listen";

describe("listen passages", () => {
  it("reads prose without markdown or page furniture", () => {
    const passages = buildListenPassages(
      "# The keeper\n\nSkip to main content\n\nThe **lighthouse** stood on the [rock](https://example.com) for a century.\n\n- It never went dark.",
    );

    expect(passages).toEqual([
      "The keeper\nThe lighthouse stood on the rock for a century.\nIt never went dark.",
    ]);
  });

  it("groups paragraphs into passages that start playing quickly", () => {
    const paragraph = "A quiet sentence about the sea. ".repeat(12).trim();
    const passages = buildListenPassages(Array.from({ length: 6 }, () => paragraph).join("\n\n"));

    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every((passage) => passage.length <= LISTEN_PASSAGE_CHARACTERS)).toBe(true);
    expect(passages.join("\n").split("\n")).toHaveLength(6);
  });

  it("only offers text it can read aloud", () => {
    expect(canListenToSource({ kind: "url", content: "Words.", mimeType: null })).toBe(true);
    expect(canListenToSource({ kind: "podcast", content: "Host: hi", mimeType: null })).toBe(false);
    expect(canListenToSource({ kind: "file", content: "Said.", mimeType: "audio/mpeg" })).toBe(
      false,
    );
    expect(canListenToSource({ kind: "text", content: "  ", mimeType: null })).toBe(false);
  });
});
