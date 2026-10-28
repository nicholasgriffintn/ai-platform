import { describe, expect, it } from "vitest";

import { nextDiscoverGatherSlot } from "../gather-schedule";

const after = (hour: number, evening: boolean) =>
  nextDiscoverGatherSlot({ date: "2026-10-28", hour, evening });

describe("nextDiscoverGatherSlot", () => {
  it("tops up the feed through the day and gathers fully before each edition", () => {
    expect(after(5, true)).toEqual({ date: "2026-10-28", hour: 10, scope: "feed" });
    expect(after(13, true)).toEqual({ date: "2026-10-28", hour: 17, scope: "full" });
    expect(after(17, true)).toEqual({ date: "2026-10-29", hour: 5, scope: "full" });
  });

  it("only tops up the feed in the afternoon when the evening edition is off", () => {
    expect(after(13, false)).toEqual({ date: "2026-10-28", hour: 17, scope: "feed" });
    expect(after(2, false)).toEqual({ date: "2026-10-28", hour: 5, scope: "full" });
  });
});
