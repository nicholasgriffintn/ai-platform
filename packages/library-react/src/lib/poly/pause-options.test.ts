import { describe, expect, it } from "vitest";

import { buildPolyPauseOptions } from "./pause-options.js";

describe("Poly pause options", () => {
  it("never offers a pause that ends in the past or more than a week out", () => {
    const sundayNight = new Date(2026, 9, 18, 23, 30);
    const week = 7 * 24 * 60 * 60 * 1000;

    for (const option of buildPolyPauseOptions(sundayNight)) {
      const endsIn = Date.parse(option.until) - sundayNight.getTime();

      expect(endsIn).toBeGreaterThan(0);
      expect(endsIn).toBeLessThanOrEqual(week);
    }
  });

  it("resumes on the next Monday morning, not today, when asked on a Monday", () => {
    const mondayNoon = new Date(2026, 9, 19, 12, 0);
    const weekStart = buildPolyPauseOptions(mondayNoon).find(({ id }) => id === "week-start");

    expect(new Date(weekStart?.until ?? "").getDate()).toBe(26);
  });
});
