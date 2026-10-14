import { describe, expect, it } from "vitest";

import { verifyQuotes } from "./verify";

describe("verifyQuotes", () => {
  it("matches quotes despite case, punctuation, and whitespace differences", () => {
    expect(
      verifyQuotes("Dr. SMITH's   research, published in 2023, cost $100.50 (about €85).", [
        "  dr smiths research ",
        "published in 2023",
        "cost 10050 about 85",
      ]),
    ).toEqual({ verified: true, missingQuotes: [] });
  });

  it("returns only missing quotes in their original order", () => {
    expect(
      verifyQuotes("This article contains some quotes but not all of them.", [
        "article contains",
        "missing quote",
        "not all",
        "another missing",
      ]),
    ).toEqual({ verified: false, missingQuotes: ["missing quote", "another missing"] });
  });

  it("accepts an article when there are no quotes to verify", () => {
    expect(verifyQuotes("This is an article.", [])).toEqual({
      verified: true,
      missingQuotes: [],
    });
  });

  it("reports every quote missing from an empty article", () => {
    expect(verifyQuotes("", ["test quote"])).toEqual({
      verified: false,
      missingQuotes: ["test quote"],
    });
  });
});
