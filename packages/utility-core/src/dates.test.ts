import { describe, expect, it } from "vitest";

import { isDeadlinePassed } from "./dates.js";

const now = new Date("2026-06-07T12:00:00.000Z");

describe("isDeadlinePassed", () => {
  it("is true only once the deadline is reached", () => {
    expect(isDeadlinePassed("2026-06-07T11:59:59.000Z", now)).toBe(true);
    expect(isDeadlinePassed("2026-06-07T12:00:00.000Z", now)).toBe(true);
    expect(isDeadlinePassed("2026-06-07T12:00:01.000Z", now)).toBe(false);
  });

  it("accepts a string reference time", () => {
    expect(isDeadlinePassed("2026-06-07T12:00:00.000Z", "2026-06-07T12:00:00.000Z")).toBe(true);
  });

  it("treats missing or invalid deadlines as not passed", () => {
    expect(isDeadlinePassed(undefined, now)).toBe(false);
    expect(isDeadlinePassed(null, now)).toBe(false);
    expect(isDeadlinePassed("", now)).toBe(false);
    expect(isDeadlinePassed("not-a-date", now)).toBe(false);
  });
});
