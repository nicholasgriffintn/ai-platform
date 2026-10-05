import { describe, expect, it } from "vitest";

import { buildDocumentContent, countDocumentWords, writeDocumentInputSchema } from "./documents.js";

describe("writeDocumentInputSchema", () => {
  it("refuses an empty body, so an empty document is never saved", () => {
    expect(writeDocumentInputSchema.safeParse({ title: "Brief", body: "" }).success).toBe(false);
  });

  it("requires a captured revision when replacing an existing document", () => {
    expect(
      writeDocumentInputSchema.safeParse({ title: "Brief", body: "Revised", outputId: "document" })
        .success,
    ).toBe(false);
    expect(
      writeDocumentInputSchema.safeParse({
        title: "Brief",
        body: "Revised",
        outputId: "document",
        expectedRevision: 3,
      }).success,
    ).toBe(true);
  });
});

describe("document statistics", () => {
  it("counts words across any run of whitespace", () => {
    expect(countDocumentWords("one  two\n\nthree\tfour ")).toBe(4);
    expect(countDocumentWords("   ")).toBe(0);
  });

  it("stays linear on a long run of whitespace", () => {
    const started = Date.now();

    expect(countDocumentWords(" ".repeat(500_000))).toBe(0);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe("buildDocumentContent", () => {
  it("recomputes the statistics rather than trusting what it was handed", () => {
    const content = buildDocumentContent("one two three", {
      wordCount: 99,
      readingTime: 99,
      tags: ["brief"],
    });

    expect(content.metadata).toMatchObject({ wordCount: 3, readingTime: 1, tags: ["brief"] });
  });
});
