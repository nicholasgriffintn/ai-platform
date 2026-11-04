import type { DiscoverInterestProfile } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { chooseResearchTopics, mergeInterestProfile } from "../interests";

const sleepToken = { topic: "Sleep Token", evidence: ["Last.fm: Sleep Token, Damocles"] };
const asimov = { topic: "Isaac Asimov", evidence: ["Readwise: Foundation, Isaac Asimov"] };

function topicsOf(profile: DiscoverInterestProfile): string[] {
  return profile.interests.map((interest) => interest.topic);
}

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
      topicsOf(mergeInterestProfile(profile, [sleepToken], { today: "2026-10-15", hidden: [] })),
    ).toEqual(["Sleep Token", "Isaac Asimov"]);
    expect(
      topicsOf(mergeInterestProfile(profile, [sleepToken], { today: "2026-10-16", hidden: [] })),
    ).toEqual(["Sleep Token"]);
  });

  it("drops a topic as soon as it is hidden", () => {
    const profile = mergeInterestProfile(null, [sleepToken, asimov], {
      today: "2026-10-27",
      hidden: [],
    });

    expect(
      topicsOf(mergeInterestProfile(profile, [], { today: "2026-10-28", hidden: ["Sleep Token"] })),
    ).toEqual(["Isaac Asimov"]);
  });
});

function inferred(topic: string, evidence: string[]) {
  return { topic, evidence, firstSeen: "2026-10-29", lastSeen: "2026-11-01", days: 4 };
}

const today = "2026-11-01";
const doctorWho = inferred("Doctor Who", ["Film and TV shelf: Doctor Who", "Reddit: r/doctorwho"]);
const simpsons = inferred("The Simpsons", [
  "Film and TV week ahead: S38E5",
  "Reddit: r/TheSimpsons",
]);
const asimovInterest = inferred("Isaac Asimov", ["Readwise: Foundation", "Readwise: I, Robot"]);
const weeknd = inferred("The Weeknd", ["Last.fm: 22 plays", "Reddit: r/popculturechat"]);

function choose(overrides: Partial<Parameters<typeof chooseResearchTopics>[0]> = {}) {
  return chooseResearchTopics({
    followed: [],
    asked: [],
    more: [],
    saved: [],
    inferred: [asimovInterest, weeknd, doctorWho, simpsons],
    engaged: new Map(),
    researchedOn: new Map(),
    hidden: [],
    today,
    ...overrides,
  });
}

describe("chooseResearchTopics", () => {
  it("researches what you acted on every day but only two inferred interests", () => {
    expect(
      choose({ followed: ["Cloudflare Workers"], more: ["Space"], saved: ["Robot fiction"] }),
    ).toEqual(["Cloudflare Workers", "Space", "Robot fiction", "The Weeknd", "Doctor Who"]);
  });

  it("rests an inferred interest for a few days after it was researched", () => {
    const researchedOn = new Map([
      ["the weeknd", "2026-10-31"],
      ["doctor who", "2026-10-30"],
      ["the simpsons", "2026-10-29"],
    ]);

    expect(choose({ researchedOn })).toEqual(["The Simpsons", "Isaac Asimov"]);
  });

  it("keeps today's rotation steady when Discover gathers again", () => {
    expect(choose({ researchedOn: new Map([["isaac asimov", today]]) })).toEqual([
      "Isaac Asimov",
      "The Weeknd",
    ]);
  });

  it("stops researching an interest once its activity goes quiet", () => {
    const quiet = { ...simpsons, lastSeen: "2026-10-29" };

    expect(
      choose({ inferred: [quiet, asimovInterest], engaged: new Map([["the simpsons", 4]]) }),
    ).toEqual(["Isaac Asimov"]);
  });

  it("lets opens move an interest up without making it daily", () => {
    const engaged = new Map([["the simpsons", 4]]);

    expect(choose({ engaged })).toEqual(["The Simpsons", "The Weeknd"]);
    expect(choose({ engaged, researchedOn: new Map([["the simpsons", "2026-10-31"]]) })).toEqual([
      "The Weeknd",
      "Doctor Who",
    ]);
  });
});
