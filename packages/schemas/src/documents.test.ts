import { describe, expect, it } from "vitest";

import {
  buildDocumentContent,
  countDocumentWords,
  deriveDocumentStatistics,
  documentExportFilename,
  documentOutputContentSchema,
  readDocumentBody,
  readDocumentMetadata,
  writeDocumentInputSchema,
} from "./documents.js";

describe("readDocumentBody", () => {
  it("reads a markdown document body", () => {
    expect(readDocumentBody({ format: "markdown", body: "# Brief" })).toBe("# Brief");
  });

  it("returns nothing for a result that is not a document", () => {
    expect(readDocumentBody({ url: "https://example.test/image.png" })).toBeNull();
  });

  it("returns nothing when there is no content at all", () => {
    expect(readDocumentBody(undefined)).toBeNull();
  });
});

describe("documentExportFilename", () => {
  it("turns a title into a markdown filename", () => {
    expect(documentExportFilename("Launch week brief")).toBe("launch-week-brief.md");
  });

  it("drops punctuation rather than leaking it into the filename", () => {
    expect(documentExportFilename("Q4: what shipped?")).toBe("q4-what-shipped.md");
  });

  it("falls back when a title has nothing usable in it", () => {
    expect(documentExportFilename("!!!")).toBe("document.md");
  });
});

describe("writeDocumentInputSchema", () => {
  it("accepts a document with a title and a body", () => {
    expect(writeDocumentInputSchema.safeParse({ title: "Brief", body: "# Brief" }).success).toBe(
      true,
    );
  });

  it("refuses an empty body, so an empty document is never saved", () => {
    expect(writeDocumentInputSchema.safeParse({ title: "Brief", body: "" }).success).toBe(false);
  });

  it("accepts an outputId, which revises rather than duplicating", () => {
    const parsed = writeDocumentInputSchema.safeParse({
      title: "Brief",
      body: "# Brief",
      outputId: "output-1",
    });

    expect(parsed.success && parsed.data.outputId).toBe("output-1");
  });
});

describe("document statistics", () => {
  it("counts words across any run of whitespace", () => {
    expect(countDocumentWords("one  two\n\nthree\tfour ")).toBe(4);
    expect(countDocumentWords("   ")).toBe(0);
  });

  it("rounds reading time up to a whole minute, never to zero", () => {
    expect(deriveDocumentStatistics("").readingTime).toBe(1);
    expect(deriveDocumentStatistics("word ".repeat(201)).readingTime).toBe(2);
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

  it("produces content the schema accepts", () => {
    expect(documentOutputContentSchema.safeParse(buildDocumentContent("body")).success).toBe(true);
  });
});

describe("readDocumentMetadata", () => {
  it("reads metadata back, and reports none when there is none", () => {
    expect(readDocumentMetadata(buildDocumentContent("a", { summary: "s" }))).toMatchObject({
      summary: "s",
    });
    expect(readDocumentMetadata({ format: "markdown", body: "a" })).toBeNull();
    expect(readDocumentMetadata({ url: "https://example.test" })).toBeNull();
  });

  it("keeps a body readable whether or not metadata is present", () => {
    expect(readDocumentBody(buildDocumentContent("a body"))).toBe("a body");
  });
});
