import { describe, expect, it } from "vitest";

import { buildSourceMaterial } from "../application/material";

function source(title: string, content: string, summary?: string) {
  return {
    title,
    content,
    external_uri: null,
    metadata: JSON.stringify(
      summary
        ? {
            summary: {
              summary,
              keyPoints: [`${title} point`],
              topics: [],
              contentHash: "hash",
              generatedAt: "2026-10-25T00:00:00.000Z",
            },
          }
        : {},
    ),
  };
}

describe("buildSourceMaterial", () => {
  it("uses full text when everything fits", () => {
    const material = buildSourceMaterial(
      [source("A", "Alpha text", "Alpha summary"), source("B", "Beta text")],
      1_000,
    );

    expect(material).toBe("## A\n\nAlpha text\n\n## B\n\nBeta text");
  });

  it("falls back to summaries so one long source does not crowd out the rest", () => {
    const material = buildSourceMaterial(
      [
        source("Long", "x".repeat(500), "Long summary"),
        source("Short", "Short text", "Short summary"),
      ],
      200,
    );

    expect(material).toContain("## Long\n\nLong summary\n- Long point");
    expect(material).toContain("## Short\n\nShort text");
  });
});
