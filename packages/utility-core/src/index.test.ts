import { describe, expect, it } from "vitest";

import {
  areUserIdsEqual,
  clampPercentage,
  formatRelativeTime,
  formatUnknownValue,
  joinNonEmptyStrings,
  parseCommaSeparatedList,
  parseNumberInputValue,
  parseRecordValue,
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
  });
});
