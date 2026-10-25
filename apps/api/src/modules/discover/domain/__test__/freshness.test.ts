import { describe, expect, it } from "vitest";

import { isDiscoverGatherFresh } from "../freshness";

const NOW = Date.parse("2026-10-24T07:00:00.000Z");
const RECENT = "2026-10-24T05:10:00.000Z";
const OLD = "2026-10-22T05:10:00.000Z";

describe("isDiscoverGatherFresh", () => {
  it("never treats an empty notebook as fresh", () => {
    expect(isDiscoverGatherFresh({ signals: [], research: [], expectedSignals: 0, now: NOW })).toBe(
      false,
    );
  });

  it("gathers when connected services have never been read", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [],
        research: [{ readAt: RECENT }],
        expectedSignals: 3,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("counts a recent failed read as an attempt", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ providerId: "lastfm", readAt: null, attemptedAt: RECENT }],
        research: [{ readAt: RECENT }],
        expectedSignals: 1,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("gathers again once everything is a day old", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ providerId: "lastfm", readAt: OLD, attemptedAt: OLD }],
        research: [{ readAt: OLD }],
        expectedSignals: 1,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("stays fresh after this morning's gather even when a topic was not researched", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ providerId: "lastfm", readAt: RECENT, attemptedAt: RECENT }],
        research: [{ readAt: OLD }, { readAt: RECENT }],
        expectedSignals: 1,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("gathers when only a Mac has shared activity since this morning", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ providerId: "device_browsing", readAt: RECENT, attemptedAt: null }],
        research: [],
        expectedSignals: 2,
        now: NOW,
      }),
    ).toBe(false);
  });
});
