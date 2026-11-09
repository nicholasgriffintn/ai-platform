import { describe, expect, it } from "vitest";

import { listDroppedOff, rollUpCoverageDay } from "../coverage";

const DAY = "2026-11-08";

describe("rollUpCoverageDay", () => {
  it("counts articles and leads per outlet for topics and stories, and terms per day", () => {
    const rollup = rollUpCoverageDay(
      DAY,
      [
        { storyId: "s1", outletId: "bbc", outletName: "BBC", topicKey: "world news", isLead: true },
        {
          storyId: "s1",
          outletId: "bbc",
          outletName: "BBC",
          topicKey: "world news",
          isLead: false,
        },
        {
          storyId: "s1",
          outletId: "guardian",
          outletName: "The Guardian",
          topicKey: "world news",
          isLead: false,
        },
        { storyId: "s2", outletId: "bbc", outletName: "BBC", topicKey: null, isLead: true },
      ],
      [
        { storyId: "s1", entityId: "e1", name: "Keir Starmer" },
        { storyId: "s2", entityId: "e1", name: "Keir Starmer" },
      ],
    );

    expect(rollup.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectKind: "topic",
          subjectKey: "world news",
          outletId: "bbc",
          articleCount: 2,
          leadCount: 1,
        }),
        expect.objectContaining({
          subjectKind: "story",
          subjectKey: "s1",
          outletId: "guardian",
          articleCount: 1,
          leadCount: 0,
        }),
        expect.objectContaining({ subjectKind: "story", subjectKey: "s2", leadCount: 1 }),
      ]),
    );
    expect(rollup.coverage.filter((row) => row.subjectKind === "topic")).toHaveLength(2);
    expect(rollup.terms).toEqual(
      expect.arrayContaining([
        {
          day: DAY,
          termKind: "entity",
          termKey: "e1",
          term: "Keir Starmer",
          articleCount: 4,
          storyCount: 2,
        },
        {
          day: DAY,
          termKind: "topic",
          termKey: "world news",
          term: "world news",
          articleCount: 3,
          storyCount: 1,
        },
      ]),
    );
  });
});

describe("listDroppedOff", () => {
  it("keeps stories that at least halved from a meaningful week, biggest drop first", () => {
    expect(
      listDroppedOff([
        { storyId: "steady", previous: 6, current: 5 },
        { storyId: "halved", previous: 4, current: 2 },
        { storyId: "gone", previous: 9, current: 0 },
        { storyId: "thin", previous: 2, current: 0 },
        { storyId: "new", previous: 0, current: 7 },
      ]).map((window) => window.storyId),
    ).toEqual(["gone", "halved"]);
  });
});
