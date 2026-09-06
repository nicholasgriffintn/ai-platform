import { describe, expect, it } from "vitest";

import { documentExportFilename, readDocumentBody, writeDocumentInputSchema } from "./documents";

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
