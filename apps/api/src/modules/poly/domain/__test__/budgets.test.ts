import { describe, expect, it } from "vitest";

import { admitPolyNotification } from "../budgets";

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const minutesAgo = (minutes: number) => NOW - minutes * 60 * 1000;

describe("admitPolyNotification", () => {
  it("keeps anything below high urgency quiet", () => {
    expect(admitPolyNotification({ urgency: "normal", notifiedAt: [], now: NOW })).toEqual({
      admitted: false,
      reason: "not_urgent",
    });
    expect(admitPolyNotification({ urgency: "high", notifiedAt: [], now: NOW })).toEqual({
      admitted: true,
      reason: "owner_must_act",
    });
  });

  it("spaces high-urgency interruptions half an hour apart but lets critical ones through", () => {
    const notifiedAt = [minutesAgo(10)];

    expect(admitPolyNotification({ urgency: "high", notifiedAt, now: NOW })).toEqual({
      admitted: false,
      reason: "spacing",
    });
    expect(admitPolyNotification({ urgency: "critical", notifiedAt, now: NOW })).toEqual({
      admitted: true,
      reason: "owner_must_act",
    });
  });

  it("stops at five interruptions a day, critical included, and forgets yesterday", () => {
    const today = [
      minutesAgo(40),
      minutesAgo(80),
      minutesAgo(120),
      minutesAgo(160),
      minutesAgo(200),
    ];

    expect(admitPolyNotification({ urgency: "critical", notifiedAt: today, now: NOW })).toEqual({
      admitted: false,
      reason: "daily_cap",
    });
    expect(
      admitPolyNotification({
        urgency: "critical",
        notifiedAt: today.map((at) => at - 24 * 60 * 60 * 1000),
        now: NOW,
      }),
    ).toEqual({ admitted: true, reason: "owner_must_act" });
  });
});
