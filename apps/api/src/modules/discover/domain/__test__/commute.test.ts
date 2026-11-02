import { describe, expect, it } from "vitest";

import { describeDiscoverCommute } from "../commute";

const input = {
  direction: "outbound" as const,
  date: "2026-11-02",
  departure: "08:00",
  now: new Date("2026-11-02T07:45:00Z"),
  fingerprint: "route",
  alertDelayMinutes: 15,
};
const journey = {
  durationMinutes: 35,
  disruptions: [],
};

describe("Connected transit observations", () => {
  it("does not manufacture disruption from a normal first observation or an empty result", () => {
    expect(describeDiscoverCommute([], input)).toBeNull();
    expect(describeDiscoverCommute([journey], input)).toMatchObject({
      actionable: false,
      journey: { durationMinutes: 35, baselineMinutes: 35 },
      expiresAt: "2026-11-02T08:00:00.000Z",
    });
  });

  it("reports material delay and TfL disruptions", () => {
    expect(
      describeDiscoverCommute([{ ...journey, durationMinutes: 50 }], {
        ...input,
        baselineMinutes: 35,
      })?.actionable,
    ).toBe(true);
    const disrupted = describeDiscoverCommute(
      [{ ...journey, disruptions: ["Line suspended"] }],
      input,
    );

    expect(disrupted?.actionable).toBe(true);
    expect(disrupted?.text).toContain("Line suspended");
    expect(disrupted?.source).toContain("Transport for London Journey Planner API");
  });
});
