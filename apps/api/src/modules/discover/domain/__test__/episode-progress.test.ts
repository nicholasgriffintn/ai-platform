import { describe, expect, it } from "vitest";

import { readEpisodeProgress } from "../episodes";

describe("readEpisodeProgress", () => {
  it("keeps the furthest point and the resume position", () => {
    expect(
      readEpisodeProgress(JSON.stringify({ furthest: 0.6, resume: { chapter: 2, seconds: 41 } })),
    ).toEqual({ furthest: 0.6, resume: { chapter: 2, seconds: 41 } });
  });

  it("reads state written before resume positions existed", () => {
    expect(readEpisodeProgress(JSON.stringify({ furthest: 0.5 }))).toEqual({
      furthest: 0.5,
      resume: null,
    });
  });

  it("treats missing or broken state as unwatched", () => {
    expect(readEpisodeProgress(null)).toEqual({ furthest: 0, resume: null });
    expect(readEpisodeProgress("not json")).toEqual({ furthest: 0, resume: null });
    expect(
      readEpisodeProgress(JSON.stringify({ furthest: "lots", resume: { chapter: -1 } })),
    ).toEqual({ furthest: 0, resume: null });
  });
});
