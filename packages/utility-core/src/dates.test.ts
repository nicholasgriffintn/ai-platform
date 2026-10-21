import { describe, expect, it } from "vitest";

import { extendTimestamps, isDeadlinePassed } from "./dates.js";

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

describe("extendTimestamps", () => {
  it("continues a regular step in the input's own format", () => {
    expect(extendTimestamps(["2026-03-01", "2026-03-02", "2026-03-03"], 2)).toEqual([
      "2026-03-04",
      "2026-03-05",
    ]);
    expect(extendTimestamps(["2026-03-01T00:00:00.000Z", "2026-03-01T00:15:00.000Z"], 1)).toEqual([
      "2026-03-01T00:30:00.000Z",
    ]);
  });

  it("steps by calendar month and keeps month ends", () => {
    expect(extendTimestamps(["2025-12-31", "2026-01-31"], 3)).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(extendTimestamps(["2025-10", "2025-11", "2025-12"], 2)).toEqual(["2026-01", "2026-02"]);
  });

  it("gives up on timestamps it cannot continue", () => {
    expect(extendTimestamps(["2026-03-01"], 2)).toBeNull();
    expect(extendTimestamps(["2026-03-02", "2026-03-01"], 2)).toBeNull();
    expect(extendTimestamps(["2026-03-01", "soon"], 2)).toBeNull();
  });
});
