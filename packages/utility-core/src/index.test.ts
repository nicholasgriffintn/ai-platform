import { describe, expect, it } from "vitest";

import {
  areUserIdsEqual,
  clampPercentage,
  compareNaturalText,
  escapeHtml,
  formatRelativeTime,
  formatUnknownValue,
  joinNonEmptyStrings,
  parseCommaSeparatedList,
  parseNumberInputValue,
  parseRecordValue,
  reverseCopy,
  slugify,
  trimTrailingCharacter,
  sortCopy,
} from "./index";

describe("utility-core", () => {
  it("normalises numeric inputs and percentages", () => {
    expect(clampPercentage(Number.NaN)).toBe(0);
    expect(clampPercentage(140)).toBe(100);
    expect(parseNumberInputValue("12.5")).toBe(12.5);
    expect(parseNumberInputValue("12.5", { integer: true })).toBe(12);
    expect(parseNumberInputValue("nope")).toBe("");
  });

  it("normalises common string collections", () => {
    expect(parseCommaSeparatedList(" alpha, , beta ")).toEqual(["alpha", "beta"]);
    expect(joinNonEmptyStrings([" alpha ", undefined, "beta"])).toBe("alpha beta");
  });

  it("sorts digit sequences by their numeric value", () => {
    const values = ["11. Search", "2. React", "10. Web", "1. Ask"];

    expect(sortCopy(values, compareNaturalText)).toEqual([
      "1. Ask",
      "2. React",
      "10. Web",
      "11. Search",
    ]);
  });

  it("copies collections before sorting or reversing them", () => {
    const values = [3, 1, 2];

    expect(sortCopy(values, (left, right) => left - right)).toEqual([1, 2, 3]);
    expect(reverseCopy(values)).toEqual([2, 1, 3]);
    expect(values).toEqual([3, 1, 2]);
  });

  it("handles unknown records without throwing", () => {
    expect(parseRecordValue('{"valid":true}')).toEqual({ valid: true });
    expect(parseRecordValue("invalid")).toEqual({});
    expect(formatUnknownValue({ valid: true })).toBe('{\n  "valid": true\n}');
  });

  it("compares mixed user identifiers", () => {
    expect(areUserIdsEqual(42, "42")).toBe(true);
    expect(areUserIdsEqual(null, null)).toBe(false);
  });

  it("formats relative dates from an injected clock", () => {
    expect(formatRelativeTime("2026-08-12T12:00:00Z", new Date("2026-08-13T12:00:00Z"))).toBe(
      "1 day ago",
    );
    expect(formatRelativeTime("2026-08-30 12:30:00", new Date("2026-08-30T12:31:00Z"))).toBe(
      "1 minute ago",
    );
  });

  it("escapes every character that could break out of markup or an attribute", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;",
    );
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("slugify", () => {
  it("collapses runs of punctuation and spaces into single separators", () => {
    expect(slugify("Q4: what shipped?")).toBe("q4-what-shipped");
    expect(slugify("  Launch   week  ")).toBe("launch-week");
  });

  it("returns nothing when there is nothing usable to slug", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("trims the separator a truncation would otherwise leave behind", () => {
    expect(slugify("abcd efgh", 5)).toBe("abcd");
  });

  it("stays linear on a long run of separators", () => {
    const started = Date.now();

    expect(slugify(`${"-".repeat(50_000)}x`)).toBe("x");
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe("trimTrailingCharacter", () => {
  it("removes only the trailing run of the given character", () => {
    expect(trimTrailingCharacter("Heading ###", "#")).toBe("Heading ");
    expect(trimTrailingCharacter("### Heading", "#")).toBe("### Heading");
  });

  it("returns nothing when the value is only that character", () => {
    expect(trimTrailingCharacter("####", "#")).toBe("");
  });

  it("stays linear on a long trailing run", () => {
    const started = Date.now();

    expect(trimTrailingCharacter(`x${"#".repeat(200_000)}`, "#")).toBe("x");
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
