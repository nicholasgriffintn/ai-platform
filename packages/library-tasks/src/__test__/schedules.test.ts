import { describe, expect, it } from "vitest";

import { pollingSchedule } from "../polling.js";
import { nextRunAt, parseInterval } from "../schedule.js";

describe("schedules", () => {
  it("parses intervals and computes the next run for intervals and cron expressions", () => {
    expect(parseInterval("15m")).toBe(900_000);
    expect(parseInterval(250)).toBe(250);
    expect(() => parseInterval("soon")).toThrow("Invalid interval");

    const at = new Date("2026-09-18T10:07:00.000Z");

    expect(nextRunAt({ every: "1h" }, at)?.toISOString()).toBe("2026-09-18T11:07:00.000Z");
    expect(nextRunAt({ cron: "0 12 * * *" }, at)?.toISOString()).toBe("2026-09-18T12:00:00.000Z");
  });
});

describe("pollingSchedule", () => {
  const now = () => Date.parse("2026-09-18T10:00:00.000Z");

  it("backs off along the delay table and then holds the last delay", () => {
    expect(pollingSchedule({ now })).toMatchObject({
      attempt: 1,
      delaySeconds: 5,
      scheduledAt: "2026-09-18T10:00:05.000Z",
      exhausted: false,
    });
    expect(pollingSchedule({ attempt: 2, now })).toMatchObject({ attempt: 3, delaySeconds: 20 });
    expect(pollingSchedule({ attempt: 9, now })).toMatchObject({ attempt: 10, delaySeconds: 30 });
  });

  it("reports exhaustion once the attempt cap is passed", () => {
    expect(pollingSchedule({ attempt: 3, maxAttempts: 3, now }).exhausted).toBe(true);
    expect(pollingSchedule({ attempt: 2, maxAttempts: 3, now }).exhausted).toBe(false);
  });

  it("honours a custom delay table", () => {
    expect(pollingSchedule({ attempt: 1, delaysSeconds: [1, 60], now })).toMatchObject({
      delaySeconds: 60,
      scheduledAt: "2026-09-18T10:01:00.000Z",
    });
  });
});
