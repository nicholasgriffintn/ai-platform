import { describe, expect, it } from "vitest";

import { authoredSkillProvenanceSchema } from "./skills";

describe("authored skill provenance", () => {
  it("accepts only the bounded public revision identity", () => {
    const provenance = {
      source: "user-authored",
      scope: "project",
      skill: "release-checklist",
      revisionId: "revision-7",
      revision: 7,
    };

    expect(authoredSkillProvenanceSchema.parse(provenance)).toEqual(provenance);
    expect(
      authoredSkillProvenanceSchema.safeParse({
        ...provenance,
        internalSkillId: "must-not-leak",
      }).success,
    ).toBe(false);
  });
});
