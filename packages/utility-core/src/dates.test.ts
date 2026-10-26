import { describe, expect, it } from "vitest";

import {
  calendarDateFromParts,
  isDailyScheduleDue,
  isDeadlinePassed,
  isoWeekKey,
  wholeYearsSince,
} from "./dates.js";

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

describe("isoWeekKey", () => {
  it("names the ISO week, counting year-end days into the week they belong to", () => {
    expect(isoWeekKey("2026-10-24")).toBe("2026-w43");
    expect(isoWeekKey("2027-01-01")).toBe("2026-w53");
    expect(isoWeekKey("2025-12-29")).toBe("2026-w01");
  });
});

describe("daily schedules", () => {
  const weekdays = { days: [1, 2, 3, 4, 5], time: "09:15", timeZone: "Europe/London" };
  const tuesdayMorning = new Date("2026-10-27T09:30:00.000Z");

  it("runs once on a scheduled day after its time", () => {
    expect(isDailyScheduleDue(weekdays, null, tuesdayMorning)).toBe(true);
    expect(isDailyScheduleDue(weekdays, "2026-10-27T09:16:00.000Z", tuesdayMorning)).toBe(false);
    expect(isDailyScheduleDue(weekdays, null, new Date("2026-10-27T08:00:00.000Z"))).toBe(false);
  });

  it("stays quiet up to and including the paused-until date", () => {
    expect(
      isDailyScheduleDue({ ...weekdays, pausedUntil: "2026-10-27" }, null, tuesdayMorning),
    ).toBe(false);
    expect(
      isDailyScheduleDue({ ...weekdays, pausedUntil: "2026-10-26" }, null, tuesdayMorning),
    ).toBe(true);
  });
});
