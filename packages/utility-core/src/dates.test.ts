import { describe, expect, it } from "vitest";

import { calendarDateFromParts, isDeadlinePassed, wholeYearsSince } from "./dates.js";

const now = new Date("2026-06-07T12:00:00.000Z");

describe("isDeadlinePassed", () => {
  it("is true only once the deadline is reached", () => {
    expect(isDeadlinePassed("2026-06-07T11:59:59.000Z", now)).toBe(true);
    expect(isDeadlinePassed("2026-06-07T12:00:00.000Z", now)).toBe(true);
    expect(isDeadlinePassed("2026-06-07T12:00:01.000Z", now)).toBe(false);
  });

  it("treats missing or invalid deadlines as not passed", () => {
    expect(isDeadlinePassed(undefined, now)).toBe(false);
    expect(isDeadlinePassed(null, now)).toBe(false);
    expect(isDeadlinePassed("", now)).toBe(false);
    expect(isDeadlinePassed("not-a-date", now)).toBe(false);
  });
});

describe("wholeYearsSince", () => {
  it("counts a year only once the anniversary is reached", () => {
    expect(wholeYearsSince("2008-06-07", now)).toBe(18);
    expect(wholeYearsSince("2008-06-08", now)).toBe(17);
  });

  it("treats a leap-day date as reached on 1 March in other years", () => {
    expect(wholeYearsSince("2008-02-29", new Date("2026-02-28T12:00:00.000Z"))).toBe(17);
    expect(wholeYearsSince("2008-02-29", new Date("2026-03-01T00:00:00.000Z"))).toBe(18);
  });

  it("rejects impossible, malformed and future dates", () => {
    expect(wholeYearsSince("2007-02-29", now)).toBeNull();
    expect(wholeYearsSince("07/06/2008", now)).toBeNull();
    expect(wholeYearsSince("2027-01-01", now)).toBeNull();
  });
});

describe("calendarDateFromParts", () => {
  it("builds a padded calendar date only for real dates", () => {
    expect(calendarDateFromParts(2008, 2, 9)).toBe("2008-02-09");
    expect(calendarDateFromParts(2008, 2, 29)).toBe("2008-02-29");
    expect(calendarDateFromParts(2007, 2, 29)).toBeNull();
    expect(calendarDateFromParts(2008, 13, 1)).toBeNull();
    expect(calendarDateFromParts(208, 1, 1)).toBeNull();
    expect(calendarDateFromParts(Number.NaN, 1, 1)).toBeNull();
  });
});
