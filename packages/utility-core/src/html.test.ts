import { describe, expect, it } from "vitest";

import { listHtmlComments, listHtmlTags } from "./html";

describe("listHtmlComments", () => {
  it("finds closed comments and ignores an unterminated one", () => {
    expect(listHtmlComments("a <!-- one --> b <!--two--> <!-- open")).toEqual([
      { index: 2, length: 12, body: " one " },
      { index: 17, length: 10, body: "two" },
    ]);
  });

  it("stays fast on many unterminated openers", () => {
    const started = performance.now();

    expect(listHtmlComments("<!--a".repeat(100_000))).toEqual([]);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("listHtmlTags", () => {
  it("takes the innermost tag when an opener is never closed", () => {
    expect(listHtmlTags("x < y <span hidden>z</span>")).toEqual([
      { index: 6, length: 13, body: "span hidden" },
      { index: 20, length: 7, body: "/span" },
    ]);
  });

  it("stays fast on many openers before a distant closer", () => {
    const started = performance.now();

    expect(listHtmlTags(`${"<".repeat(100_000)}>`)).toHaveLength(1);
    expect(listHtmlTags("<".repeat(100_000))).toEqual([]);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
