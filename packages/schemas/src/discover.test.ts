import { describe, expect, it } from "vitest";

import { composeDiscoverEditionInputSchema } from "./discover.js";

const draft = {
  greeting: "x".repeat(300),
  interests: [{ topic: "Rye bread", reason: "You follow it", sensitive: false }],
  brief: [],
  cards: [
    {
      kind: "topic",
      topic: "Rye bread",
      title: "A long title ".repeat(20),
      angle: "Why starters fail in autumn kitchens.",
      prompt: "Tell me why rye starters slow down in autumn and what to change.",
      reason: "You follow Rye bread",
      sensitive: false,
    },
  ],
};

describe("composeDiscoverEditionInputSchema", () => {
  it("accepts long text as written rather than rejecting the whole edition", () => {
    const parsed = composeDiscoverEditionInputSchema.parse(draft);

    expect(parsed.greeting).toBe(draft.greeting);
    expect(parsed.cards[0]?.kind === "topic" ? parsed.cards[0].title : "").toBe(
      draft.cards[0]?.title.trim(),
    );
  });

  it("still rejects an empty greeting", () => {
    expect(composeDiscoverEditionInputSchema.safeParse({ ...draft, greeting: "  " }).success).toBe(
      false,
    );
  });
});
