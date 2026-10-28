import { describe, expect, it } from "vitest";

import { nextDiscoverGatherSlot } from "../gather-schedule";

describe("nextDiscoverGatherSlot", () => {
  it("gathers again before the evening edition, then before tomorrow's morning", () => {
    expect(nextDiscoverGatherSlot({ date: "2026-10-28", hour: 5, evening: true })).toEqual({
      date: "2026-10-28",
      hour: 17,
      edition: "evening",
    });
    expect(nextDiscoverGatherSlot({ date: "2026-10-28", hour: 17, evening: true })).toEqual({
      date: "2026-10-29",
      hour: 5,
      edition: "morning",
    });
  });

  it("only gathers for the morning when the evening edition is off", () => {
    expect(nextDiscoverGatherSlot({ date: "2026-10-28", hour: 5, evening: false })).toEqual({
      date: "2026-10-29",
      hour: 5,
      edition: "morning",
    });
    expect(nextDiscoverGatherSlot({ date: "2026-10-28", hour: 2, evening: false })).toEqual({
      date: "2026-10-28",
      hour: 5,
      edition: "morning",
    });
  });
});
