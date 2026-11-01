import { discoverEditionContentSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildDiscoverEpisodeMaterial, shotImageKey } from "../episodes";

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

describe("buildDiscoverEpisodeMaterial", () => {
  it("keeps other topics' stories and their own projects out of an episode", () => {
    const edition = discoverEditionContentSchema.parse({
      version: 1,
      date: "2026-10-26",
      timezone: "Europe/London",
      greeting: "Morning",
      interests: [],
      brief: [{ label: "Markets", text: "Shares fell." }],
      cards: [
        {
          id: "read_1",
          kind: "read",
          topic: "Formula 1",
          title: "Verstappen takes pole in the rain",
          url: "https://example.com/f1",
          source: "Example",
          summary: "Qualifying was red-flagged twice.",
          reason: "You follow Formula 1",
        },
        {
          id: "read_2",
          kind: "read",
          topic: "formula 1",
          title: "Tyre rules change for 2027",
          url: "https://example.com/tyres",
          source: "Example",
          summary: "Narrower fronts.",
          reason: "You follow Formula 1",
        },
        {
          id: "read_3",
          kind: "read",
          topic: "Rust",
          title: "Rust 2.0 lands in nightly",
          url: "https://example.com/rust",
          source: "Example",
          summary: "The compiler team shipped it.",
          reason: "You follow Rust",
        },
        {
          id: "action_1",
          kind: "action",
          title: "Finish the release notes",
          detail: "Due today.",
          prompt: "Help me finish them.",
          reason: "Your project.",
        },
      ],
      generatedAt: "2026-10-26T07:00:00.000Z",
    });

    const material = buildDiscoverEpisodeMaterial(edition, "Formula 1", [
      { topic: "Formula 1", content: "# Formula 1\n\nThe Brazil sprint was wet." },
    ]);

    expect(material).toContain("The Brazil sprint was wet.");
    expect(material).toContain("Verstappen takes pole in the rain");
    expect(material).toContain("Tyre rules change for 2027");
    expect(material).not.toContain("Rust 2.0");
    expect(material).not.toContain("release notes");
    expect(material).not.toContain("Shares fell.");
  });
});
