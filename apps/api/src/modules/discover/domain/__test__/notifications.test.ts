import { discoverDayProfileSchema, type DiscoverObservation } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { emptyDiscoverLive } from "../live";
import {
  resolveDiscoverNotificationSubject,
  type DiscoverNotificationRecord,
} from "../notifications";

const now = new Date("2026-11-02T07:45:00Z");
const profile = discoverDayProfileSchema.parse({
  revision: 1,
  updatedAt: null,
  week: Array.from({ length: 7 }, (_, weekday) => ({ weekday, mode: "office" })),
  commute: {
    provider: "tfl",
    origin: { label: "A", latitude: 51.5, longitude: 0 },
    destination: { label: "B", latitude: 51.6, longitude: 0 },
  },
});
const observation: DiscoverObservation = {
  id: "travel:2026-11-02:outbound",
  kind: "travel",
  title: "Journey",
  text: "Line disrupted",
  source: "TfL",
  observedAt: now.toISOString(),
  expiresAt: "2026-11-02T08:00:00Z",
  actionable: true,
  fingerprint: "disrupted",
  stale: false,
};
const live = { ...emptyDiscoverLive(), profileRevision: 1, observations: [observation] };
const notification: DiscoverNotificationRecord = {
  category: "commute",
  subjectId: observation.id,
  fingerprint: observation.fingerprint,
  profileRevision: 1,
  decision: "eligible",
  expiresAt: observation.expiresAt,
};

describe("Discover notification revalidation", () => {
  it("resolves only the same fresh actionable observation inside the configured commute window", () => {
    expect(
      resolveDiscoverNotificationSubject({ notification, profile, live, briefings: [], now }),
    ).toEqual({ itemId: null, briefingId: null, observationId: observation.id });
    for (const next of [
      { ...observation, stale: true },
      { ...observation, fingerprint: "resolved" },
      { ...observation, actionable: false },
    ]) {
      expect(
        resolveDiscoverNotificationSubject({
          notification,
          profile,
          live: { ...live, observations: [next] },
          briefings: [],
          now,
        }),
      ).toBeNull();
    }

    expect(
      resolveDiscoverNotificationSubject({
        notification,
        profile: { ...profile, revision: 2 },
        live,
        briefings: [],
        now,
      }),
    ).toBeNull();
    expect(
      resolveDiscoverNotificationSubject({
        notification,
        profile,
        live,
        briefings: [],
        now: new Date("2026-11-02T08:01:00Z"),
      }),
    ).toBeNull();
    expect(
      resolveDiscoverNotificationSubject({
        notification,
        profile: { ...profile, overrides: [{ date: "2026-11-02", mode: "remote" }] },
        live,
        briefings: [],
        now,
      }),
    ).toBeNull();
  });

  it("resolves a ready briefing only while its source and release are current", () => {
    const alert = {
      ...notification,
      category: "briefings" as const,
      subjectId: "morning",
      fingerprint: "audio-source",
    };
    const release = {
      id: "morning",
      date: "2026-11-02",
      slot: "morning" as const,
      editionId: null,
      sourceId: "audio-source",
      status: "ready" as const,
      createdAt: now.toISOString(),
    };

    expect(
      resolveDiscoverNotificationSubject({
        notification: alert,
        profile,
        live,
        briefings: [release],
        now,
      })?.briefingId,
    ).toBe("morning");
    expect(
      resolveDiscoverNotificationSubject({
        notification: alert,
        profile,
        live,
        briefings: [{ ...release, status: "failed" }],
        now,
      }),
    ).toBeNull();
  });
});
