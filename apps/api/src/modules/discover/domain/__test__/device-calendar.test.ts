import { describe, expect, it } from "vitest";

import { readUpcomingDeviceEvents } from "../device-calendar";

describe("readUpcomingDeviceEvents", () => {
  it("keeps events that have not ended and gives each one its real start and end", () => {
    const lines = [
      "2026-07-10 10:00–10:15 · AI Enablement Stand-Up · Microsoft Teams Meeting",
      "2026-07-10 19:30–21:00 · Dinner",
      "2026-07-10 23:00–01:00 · Night shift",
      "2026-07-10 all day · Bin day",
      "2026-07-11 09:00–09:30 · Planning",
      "No events in the next seven days",
    ];

    const events = readUpcomingDeviceEvents(
      lines,
      new Date("2026-07-10T19:07:00.000Z"),
      "Europe/London",
    );

    expect(
      events.map(({ line, startsAt, endsAt }) => [
        line.split(" · ")[1],
        startsAt.toISOString(),
        endsAt.toISOString(),
      ]),
    ).toEqual([
      ["Dinner", "2026-07-10T18:30:00.000Z", "2026-07-10T20:00:00.000Z"],
      ["Night shift", "2026-07-10T22:00:00.000Z", "2026-07-11T00:00:00.000Z"],
      ["Bin day", "2026-07-09T23:00:00.000Z", "2026-07-10T23:00:00.000Z"],
      ["Planning", "2026-07-11T08:00:00.000Z", "2026-07-11T08:30:00.000Z"],
    ]);
  });
});
