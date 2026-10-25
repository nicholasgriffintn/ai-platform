import { describe, expect, it } from "vitest";

import { latestResearchSection, mergeResearchDocument } from "../research";

describe("mergeResearchDocument", () => {
  it("keeps each page's publisher and date through the document", () => {
    const document = mergeResearchDocument("", {
      date: "2026-10-25",
      results: [
        {
          title: "Rust 2.0 ships",
          url: "https://example.com/rust",
          snippet: "It ships.",
          source: "The Register",
          date: "2026-10-24",
        },
        { title: "No source", url: "https://example.com/plain", snippet: "Plain." },
      ],
    });

    expect(latestResearchSection(document)?.results).toEqual([
      {
        title: "Rust 2.0 ships",
        url: "https://example.com/rust",
        snippet: "It ships.",
        source: "The Register",
        date: "2026-10-24",
      },
      { title: "No source", url: "https://example.com/plain", snippet: "Plain." },
    ]);
  });

  it("adds a dated section and drops pages filed earlier in the week", () => {
    let document = "";

    for (let day = 1; day <= 5; day += 1) {
      document = mergeResearchDocument(document, {
        date: `2026-10-${String(day).padStart(2, "0")}`,
        results: [
          { title: `Story ${day}`, url: `https://example.com/${day}`, snippet: "What happened." },
          { title: "Repeat", url: "https://example.com/repeat", snippet: "" },
        ],
      });
    }

    const latest = latestResearchSection(document);

    expect(latest?.date).toBe("2026-10-05");
    expect(latest?.results.map((result) => result.url)).toEqual(["https://example.com/5"]);
    expect(document.match(/^## /gmu)).toHaveLength(5);
  });

  it("keeps only the newest week of sections", () => {
    let document = "";

    for (let day = 1; day <= 9; day += 1) {
      document = mergeResearchDocument(document, {
        date: `2026-10-${String(day).padStart(2, "0")}`,
        results: [{ title: `Story ${day}`, url: `https://example.com/${day}`, snippet: "" }],
      });
    }

    expect(document.match(/^## /gmu)).toHaveLength(7);
    expect(document).not.toContain("2026-10-02");
    expect(document).toContain("2026-10-03");
  });

  it("replaces the same day's section instead of duplicating it", () => {
    const first = mergeResearchDocument("", {
      date: "2026-10-24",
      results: [{ title: "Morning", url: "https://example.com/a", snippet: "" }],
    });
    const second = mergeResearchDocument(first, {
      date: "2026-10-24",
      results: [{ title: "Evening", url: "https://example.com/b", snippet: "Later on" }],
    });

    expect(latestResearchSection(second)?.results).toEqual([
      { title: "Evening", url: "https://example.com/b", snippet: "Later on" },
    ]);
  });
});
