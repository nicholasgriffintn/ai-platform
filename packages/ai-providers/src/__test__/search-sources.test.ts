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
});
