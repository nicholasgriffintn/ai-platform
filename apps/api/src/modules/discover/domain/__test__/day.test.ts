import {
  discoverDayProfileContentSchema,
  updateDiscoverDayProfileSchema,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  applyDiscoverDayUpdate,
  discoverCommuteWindow,
  isDiscoverQuiet,
  resolveDiscoverDay,
} from "../day";

describe("Discover day context", () => {
  it("uses the person's local date for a dated override and keeps the weekly routine afterwards", () => {
    const profile = discoverDayProfileContentSchema.parse({
      timezone: "America/Los_Angeles",
      overrides: [{ date: "2026-11-02", mode: "office" }],
    });

    expect(resolveDiscoverDay(profile, new Date("2026-11-03T01:00:00Z"))).toMatchObject({
      date: "2026-11-02",
      mode: "office",
      overridden: true,
    });
    expect(resolveDiscoverDay(profile, new Date("2026-11-03T17:00:00Z"))).toMatchObject({
      date: "2026-11-03",
      mode: "remote",
      overridden: false,
    });
  });

  it("applies a narrow conversational patch without resetting saved settings", () => {
    const profile = discoverDayProfileContentSchema.parse({
      timezone: "Europe/London",
      onboarded: true,
      topics: ["AI", "Football"],
      moments: { morning: "06:30", lunch: "13:00", afternoon: "16:00", evening: "20:00" },
      overrides: [{ date: "2026-11-01", mode: "office" }],
    });
    const update = updateDiscoverDayProfileSchema.parse({
      expectedRevision: 3,
      mutedTopics: ["football"],
    });
    const saved = applyDiscoverDayUpdate(profile, update, new Date("2026-11-02T09:00:00Z"));

    expect(saved).toMatchObject({
      timezone: "Europe/London",
      onboarded: true,
      topics: ["AI"],
      mutedTopics: ["football"],
      overrides: [],
      moments: profile.moments,
    });
  });

  it("suppresses commute polling on a remote override and outside travel windows", () => {
    const profile = discoverDayProfileContentSchema.parse({
      commute: {
        provider: "tfl",
        origin: { label: "Home", latitude: 51.5, longitude: -0.1 },
        destination: { label: "Office", latitude: 51.51, longitude: -0.12 },
      },
      overrides: [
        { date: "2026-11-02", mode: "office" },
        { date: "2026-11-03", mode: "remote" },
      ],
    });
    const morning = new Date("2026-11-02T07:30:00Z");
    const remote = new Date("2026-11-03T07:30:00Z");
    const lunch = new Date("2026-11-02T12:00:00Z");

    expect(discoverCommuteWindow(profile, resolveDiscoverDay(profile, morning), morning)).toEqual({
      direction: "outbound",
      departure: "08:00",
    });
    expect(discoverCommuteWindow(profile, resolveDiscoverDay(profile, remote), remote)).toBeNull();
    expect(discoverCommuteWindow(profile, resolveDiscoverDay(profile, lunch), lunch)).toBeNull();
  });

  it("keeps overnight quiet hours and working-time notification suppression independent", () => {
    const profile = discoverDayProfileContentSchema.parse({ timezone: "Europe/London" });

    expect(isDiscoverQuiet(profile, new Date("2026-11-02T22:30:00Z"))).toBe(true);
    expect(isDiscoverQuiet(profile, new Date("2026-11-03T06:30:00Z"))).toBe(true);
    expect(isDiscoverQuiet(profile, new Date("2026-11-03T10:00:00Z"))).toBe(true);
    expect(isDiscoverQuiet(profile, new Date("2026-11-03T18:30:00Z"))).toBe(false);
  });

  it("rejects ambiguous duplicate weekdays and invalid local times", () => {
    const profile = discoverDayProfileContentSchema.parse({});

    expect(
      updateDiscoverDayProfileSchema.safeParse({
        expectedRevision: 0,
        week: profile.week.map(() => profile.week[0]),
      }).success,
    ).toBe(false);
    expect(
      updateDiscoverDayProfileSchema.safeParse({
        expectedRevision: 0,
        override: { date: "2026-11-02", mode: "office", outbound: "25:00" },
      }).success,
    ).toBe(false);
  });
});
