import { describe, expect, it } from "vitest";

import { excerptAround } from "./strings";

describe("excerptAround", () => {
  it("keeps short text whole", () => {
    expect(excerptAround("Book the  Lisbon\nflights", ["lisbon"], 80)).toBe(
      "Book the Lisbon flights",
    );
  });

  it("centres a long excerpt on the first match and marks what was cut", () => {
    const text = `${"a".repeat(200)} Lisbon ${"b".repeat(200)}`;
    const excerpt = excerptAround(text, ["missing", "lisbon"], 60);

    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).toContain("Lisbon");
  });
});
