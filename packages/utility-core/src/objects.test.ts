import { describe, expect, it } from "vitest";

import { collectStrings } from "./objects";

describe("collectStrings", () => {
  it("gathers the readable sentences out of structured output content", () => {
    const text = collectStrings(
      {
        kind: "deck",
        id: "out_123",
        slides: [
          {
            title: "Launch readiness",
            bullets: ["Ship the docs by Friday", "Two risks remain open"],
          },
          {
            title: "Risks",
            notes: "Preview variability is the larger one.",
            url: "https://x.test/a",
          },
        ],
      },
      1_000,
    );

    expect(text).toBe(
      "Ship the docs by Friday Two risks remain open Preview variability is the larger one.",
    );
  });

  it("stops at the character budget", () => {
    expect(collectStrings(["one two three four five six seven"], 12)).toBe("one two t...");
  });
});
