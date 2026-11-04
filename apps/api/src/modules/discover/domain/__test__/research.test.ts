import { describe, expect, it } from "vitest";

import {
  keepDiscoverTopicResults,
  keepRecentDiscoverResults,
  latestResearchSection,
  mergeResearchDocument,
} from "../research";

describe("keepDiscoverTopicResults", () => {
  const result = (title: string, url = "https://example.com/story", snippet = "") => ({
    title,
    url,
    snippet,
  });

  it("drops search results that are not about the topic", () => {
    const kept = keepDiscoverTopicResults("Xiaomi OCR models", [
      result("Xiaomi-OCR-0: A 0.8B AI Model for Document Parsing and OCR"),
      result("Pika H3 Flex Brings More Control to AI Video Generation"),
    ]);

    expect(kept.map((item) => item.title)).toEqual([
      "Xiaomi-OCR-0: A 0.8B AI Model for Document Parsing and OCR",
    ]);
  });

  it("accepts a topic named only in the snippet", () => {
    expect(
      keepDiscoverTopicResults("Linux distributions", [
        result("Mint brings back hibernation", undefined, "The popular Linux desktop returns"),
      ]),
    ).toHaveLength(1);
  });

  it("drops press wires, stock pictures and ranked buying guides", () => {
    expect(
      keepDiscoverTopicResults("Self-hosting and Linux", [
        result("Self-hosting on Linux announced", "https://www.einnews.com/pr_news/1"),
        result("Licensable picture: Linux self-hosting rally"),
        result("10 Best VPS Services for self-hosting Linux"),
        result("Best Linux self-hosting providers in 2026"),
      ]),
    ).toEqual([]);
  });
});

describe("keepRecentDiscoverResults", () => {
  it("drops results dated before yesterday and keeps undated ones", () => {
    const result = (slug: string, date?: string) => ({
      title: slug,
      url: `https://example.com/${slug}`,
      snippet: slug,
      date,
    });
    const [document] = keepRecentDiscoverResults(
      [
        {
          topic: "Rust",
          date: "2026-11-04",
          results: [
            result("today", "2026-11-04"),
            result("yesterday", "2026-11-03"),
            result("older", "2026-11-02"),
            result("undated"),
          ],
        },
      ],
      "2026-11-04",
    );

    expect(document?.results.map((item) => item.title)).toEqual(["today", "yesterday", "undated"]);
  });
});

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
