import { describe, expect, it } from "vitest";

import {
  chooseStoryTopic,
  collectParkedSince,
  pickWindDownTonight,
  planWindDownStory,
  type RecentWindDown,
} from "../wind-down";

const evening = {
  hour: 22,
  sleepMinutes: null,
  openItems: 0,
  storyTopic: null,
  readBack: false,
  recent: [],
};

function story(topic: string, part: number, summary = `Part ${part}`): RecentWindDown {
  return { kind: "story", bed: "rain", createdAt: "2026-10-24T21:00:00Z", topic, part, summary };
}

describe("tonight's wind down", () => {
  it("parks a busy day before anything else", () => {
    expect(pickWindDownTonight({ ...evening, openItems: 4, sleepMinutes: 300 }).kind).toBe("park");
  });

  it("slows down after a short night", () => {
    const pick = pickWindDownTonight({ ...evening, sleepMinutes: 320 });

    expect(pick).toMatchObject({ kind: "body_scan", minutes: 20 });
    expect(pick.reason).toContain("5h 20m");
  });

  it("offers the next part of a running story late in the evening only", () => {
    const unwound: RecentWindDown = {
      kind: "unwind",
      bed: "embers",
      createdAt: "2026-10-25T21:00:00Z",
    };

    expect(
      pickWindDownTonight({ ...evening, storyTopic: "Lighthouses", recent: [] }).reason,
    ).toContain("slow story about Lighthouses");
    expect(
      pickWindDownTonight({
        ...evening,
        storyTopic: "Lighthouses",
        recent: [unwound, story("Lighthouses", 2)],
      }).reason,
    ).toContain("Part 3");
    expect(pickWindDownTonight({ ...evening, hour: 19, storyTopic: "Lighthouses" }).kind).toBe(
      "unwind",
    );
  });

  it("never repeats last night's kind or sound", () => {
    const pick = pickWindDownTonight({
      ...evening,
      recent: [{ kind: "unwind", bed: "night", createdAt: "2026-10-24T21:00:00Z" }],
    });

    expect(pick.kind).toBe("breathing");
    expect(pick.bed).not.toBe("night");
  });
});

describe("wind down stories", () => {
  it("continues a series until its last part, then starts again", () => {
    expect(
      planWindDownStory("Lighthouses", [story("lighthouses", 3, "The keeper slept.")]),
    ).toEqual({ topic: "Lighthouses", part: 4, previous: "The keeper slept." });
    expect(planWindDownStory("Lighthouses", [story("Lighthouses", 5)])).toEqual({
      topic: "Lighthouses",
      part: 1,
      previous: null,
    });
  });

  it("keeps a running series, otherwise picks a followed topic not yet told", () => {
    expect(chooseStoryTopic(["Trains", "Moss"], [story("Canals", 2)])).toBe("Canals");
    expect(chooseStoryTopic(["Trains", "Moss"], [story("Trains", 5)])).toBe("Moss");
    expect(chooseStoryTopic([], [])).toBeNull();
  });
});

describe("parked items", () => {
  it("hands over only what was parked since the last edition", () => {
    const park = (createdAt: string, parked: string[]): RecentWindDown => ({
      kind: "park",
      bed: "night",
      createdAt,
      parked,
    });

    expect(
      collectParkedSince(
        [park("2026-10-24T22:00:00Z", ["Email Sam"]), park("2026-10-23T22:00:00Z", ["Old"])],
        "2026-10-24T19:00:00Z",
      ),
    ).toEqual(["Email Sam"]);
  });
});
