import { describe, expect, it } from "vitest";

import { mergeInterestProfile, rankInterestProfile } from "../interests";

const sleepToken = { topic: "Sleep Token", evidence: ["Last.fm: Sleep Token, Damocles"] };
const asimov = { topic: "Isaac Asimov", evidence: ["Readwise: Foundation, Isaac Asimov"] };

describe("mergeInterestProfile", () => {
  it("builds up an interest across days but counts each day once", () => {
    const first = mergeInterestProfile(null, [sleepToken], { today: "2026-10-27", hidden: [] });
    const again = mergeInterestProfile(first, [sleepToken], { today: "2026-10-27", hidden: [] });
    const next = mergeInterestProfile(
      again,
      [{ topic: "sleep token", evidence: ["YouTube: Sleep Token live"] }],
      { today: "2026-10-28", hidden: [] },
    );

    expect(again.interests[0]?.days).toBe(1);
    expect(next.interests).toEqual([
      {
        topic: "Sleep Token",
        evidence: ["YouTube: Sleep Token live", "Last.fm: Sleep Token, Damocles"],
        firstSeen: "2026-10-27",
        lastSeen: "2026-10-28",
        days: 2,
      },
    ]);
  });

  it("keeps a quiet interest for a fortnight, then lets it go", () => {
    const profile = mergeInterestProfile(null, [asimov], { today: "2026-10-01", hidden: [] });

    expect(
      rankInterestProfile(
        mergeInterestProfile(profile, [sleepToken], { today: "2026-10-15", hidden: [] }),
      ),
    ).toEqual(["Sleep Token", "Isaac Asimov"]);
    expect(
      rankInterestProfile(
        mergeInterestProfile(profile, [sleepToken], { today: "2026-10-16", hidden: [] }),
      ),
    ).toEqual(["Sleep Token"]);
  });

  it("drops a topic as soon as it is hidden", () => {
    const profile = mergeInterestProfile(null, [sleepToken, asimov], {
      today: "2026-10-27",
      hidden: [],
    });

    expect(
      rankInterestProfile(
        mergeInterestProfile(profile, [], { today: "2026-10-28", hidden: ["Sleep Token"] }),
      ),
    ).toEqual(["Isaac Asimov"]);
  });
});
