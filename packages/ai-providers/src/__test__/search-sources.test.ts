import { describe, expect, it } from "vitest";

import { normaliseSearchSources } from "../utils/search.js";

describe("search evidence normalisation", () => {
  it("retains Parallel excerpts as answer evidence and drops unusable source URLs", () => {
    expect(
      normaliseSearchSources({
        provider: "parallel",
        results: [
          {
            url: "https://example.com/page",
            title: "Page",
            excerpts: ["First passage", "Second passage"],
          },
          { title: "Missing citation", excerpts: ["Unverifiable"] },
        ],
      }),
    ).toMatchObject([
      { url: "https://example.com/page", content: "First passage\n\nSecond passage" },
    ]);
  });

  it("includes Exa answer citations and preserves AI Search chunk provenance", () => {
    expect(
      normaliseSearchSources({
        provider: "exa",
        answer: "Answer",
        citations: [
          { id: "source", title: "Citation", url: "https://example.com", snippet: "Evidence" },
        ],
      }),
    ).toMatchObject([{ title: "Citation", content: "Evidence" }]);
    expect(
      normaliseSearchSources({
        provider: "cloudflare-ai-search",
        results: [
          {
            title: "Docs",
            url: "https://docs.example.com",
            snippet: "Passage",
            score: 0.8,
            chunkId: "chunk-1",
          },
        ],
      }),
    ).toMatchObject([{ content: "Passage", score: 0.8, chunkId: "chunk-1" }]);
  });
});
