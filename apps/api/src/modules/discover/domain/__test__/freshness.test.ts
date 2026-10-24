import { describe, expect, it } from "vitest";

import { isDiscoverGatherFresh } from "../freshness";

const NOW = Date.parse("2026-10-24T07:00:00.000Z");
const RECENT = "2026-10-24T05:10:00.000Z";
const OLD = "2026-10-22T05:10:00.000Z";

describe("isDiscoverGatherFresh", () => {
  it("never treats an empty notebook as fresh", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [],
        research: [],
        topics: [],
        expectedSignals: 0,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("gathers when connected services have never been read", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [],
        research: [{ topic: "Rye bread", readAt: RECENT }],
        topics: [],
        expectedSignals: 3,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("counts a recent failed read as an attempt", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ readAt: null, attemptedAt: RECENT }],
        research: [{ topic: "Rye bread", readAt: RECENT }],
        topics: [],
        expectedSignals: 1,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("gathers when a followed topic has no fresh research", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ readAt: RECENT, attemptedAt: RECENT }],
        research: [{ topic: "Rye bread", readAt: OLD }],
        topics: ["rye bread"],
        expectedSignals: 1,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("stays fresh when everything expected was read today", () => {
    expect(
      isDiscoverGatherFresh({
        signals: [{ readAt: RECENT, attemptedAt: RECENT }],
        research: [{ topic: "Rye bread", readAt: RECENT }],
        topics: ["Rye bread"],
        expectedSignals: 1,
        now: NOW,
      }),
    ).toBe(true);
  });
});
