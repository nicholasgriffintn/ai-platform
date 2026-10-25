import type { DiscoverEpisode, DiscoverEpisodeChapter } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { episodeStatus } from "./episode-status";

function chapter(status: DiscoverEpisodeChapter["status"], end = 0): DiscoverEpisodeChapter {
  return {
    title: status,
    beats: [],
    status,
    timings: end ? [{ start: 0, end }] : [],
    scenes: [],
  };
}

function episode(chapters: DiscoverEpisodeChapter[]): DiscoverEpisode {
  return {
    id: "episode_1",
    createdAt: "2026-10-24T07:00:00Z",
    format: "episode",
    seasonId: "season_1",
    editionId: "edition_1",
    notebookId: null,
    minutes: 12,
    topic: "Bread",
    part: 1,
    parts: 5,
    style: "watercolour",
    title: "Wild yeast",
    recap: "",
    chapters,
    progress: { furthest: 0, resume: null },
  };
}

describe("episodeStatus", () => {
  it("offers a retry once the outline has failed", () => {
    expect(episodeStatus({ episodeFailed: true }, undefined, true).state).toBe("failed");
  });

  it("is playable as soon as the first chapter is recorded", () => {
    expect(
      episodeStatus(
        { episodeId: "episode_1" },
        episode([chapter("ready", 240), chapter("rendering"), chapter("pending")]),
        false,
      ),
    ).toEqual({ state: "ready", label: "1 of 3 chapters" });
  });

  it("reports the stage of the first unfinished chapter before anything is playable", () => {
    expect(
      episodeStatus(
        { episodeId: "episode_1" },
        episode([chapter("scripting"), chapter("pending")]),
        false,
      ),
    ).toEqual({ state: "making", label: "Writing" });
  });

  it("fails only when every chapter has failed", () => {
    expect(
      episodeStatus(
        { episodeId: "episode_1" },
        episode([chapter("failed"), chapter("failed")]),
        false,
      ).state,
    ).toBe("failed");
  });
});
