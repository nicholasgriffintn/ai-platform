import type { DiscoverEpisodeChapter } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { locateEpisodeShot } from "./episode-timeline";

const shot = { visual: "A jar of starter", motion: "hold" as const, image: true };
const chapter: DiscoverEpisodeChapter = {
  title: "Wild yeast",
  beats: [],
  status: "ready",
  timings: [
    { start: 0, end: 30 },
    { start: 30, end: 40 },
  ],
  scenes: [
    { title: "Opening", caption: "", narration: "One.", shots: [shot, shot, shot] },
    { title: "Close", caption: "", narration: "Two.", shots: [shot] },
  ],
};

describe("locateEpisodeShot", () => {
  it("splits a scene's narration evenly across its shots", () => {
    expect(locateEpisodeShot(chapter, 0)).toEqual({ scene: 0, shot: 0, shotSeconds: 10 });
    expect(locateEpisodeShot(chapter, 25)).toEqual({ scene: 0, shot: 2, shotSeconds: 10 });
    expect(locateEpisodeShot(chapter, 31)).toEqual({ scene: 1, shot: 0, shotSeconds: 10 });
  });

  it("holds the last shot once the narration has finished", () => {
    expect(locateEpisodeShot(chapter, 45)).toEqual({ scene: 1, shot: 0, shotSeconds: 10 });
  });

  it("holds the first shot when the narration has not been timed yet", () => {
    expect(locateEpisodeShot({ ...chapter, timings: [] }, 12)).toEqual({
      scene: 0,
      shot: 0,
      shotSeconds: 10,
    });
  });
});
