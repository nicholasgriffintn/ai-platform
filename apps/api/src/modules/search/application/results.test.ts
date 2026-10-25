import { describe, expect, it } from "vitest";

import { withinNewsWindow } from "./results";

describe("withinNewsWindow", () => {
  it("keeps news inside the window with a day's slack and drops older or undated results", () => {
    const now = Date.parse("2026-10-25T08:00:00Z");
    const result = (url: string, date: string) => ({
      title: url,
      url,
      snippet: "",
      source: "Example",
      date,
    });

    expect(
      withinNewsWindow(
        [
          result("https://example.com/today", "2026-10-25"),
          result("https://example.com/edge", "2026-10-21"),
          result("https://example.com/old", "2026-09-04"),
          result("https://example.com/undated", ""),
        ],
        3,
        now,
      ).map((item) => item.url),
    ).toEqual(["https://example.com/today", "https://example.com/edge"]);
  });
});
