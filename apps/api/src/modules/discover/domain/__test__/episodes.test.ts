import { describe, expect, it } from "vitest";

import { shotImageKey } from "../episodes";

describe("shotImageKey", () => {
  it("shares a plate's picture across every episode in the season", () => {
    const location = { chapter: 1, scene: 2, shot: 0, plate: "the-baker" };

    expect(shotImageKey("episode_1", "season_1", location)).toBe(
      shotImageKey("episode_2", "season_1", location),
    );
    expect(shotImageKey("episode_1", "season_1", { ...location, plate: undefined })).toBe(
      "outputs/episode_1/shots/1-2-0",
    );
  });
});
