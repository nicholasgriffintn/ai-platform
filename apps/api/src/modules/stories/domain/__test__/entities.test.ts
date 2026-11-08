import { describe, expect, it } from "vitest";

import { entityKey, mergeEntityCandidates } from "../entities";

describe("entityKey", () => {
  it("merges possessive and corporate variants of the same name", () => {
    expect(entityKey("Alphabet's Google")).toBe("google");
    expect(entityKey("Google Inc.")).toBe("google");
    expect(entityKey("The Google")).toBe("google");
  });

  it("keeps distinct names apart", () => {
    expect(entityKey("Google DeepMind")).not.toBe(entityKey("Google"));
  });
});

describe("mergeEntityCandidates", () => {
  it("folds aliases into one entity and keeps the strongest role", () => {
    expect(
      mergeEntityCandidates([
        { name: "Alphabet's Google", kind: "organisation", role: "mentioned" },
        { name: "Google", kind: "organisation", role: "subject" },
      ]),
    ).toEqual([
      {
        key: "google",
        name: "Google",
        kind: "organisation",
        role: "subject",
        aliases: ["Alphabet's Google", "Google"],
      },
    ]);
  });
});
