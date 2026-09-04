import { describe, expect, it } from "vitest";

import { authoredSkillEvaluationRunInputSchema, authoredSkillProvenanceSchema } from "./skills";

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

describe("authored skill evaluation input", () => {
  it("requires exactly one saved case or ad-hoc prompt", () => {
    expect(
      authoredSkillEvaluationRunInputSchema.safeParse({
        revisionId: "revision-7",
        caseId: "case-1",
      }).success,
    ).toBe(true);
    expect(
      authoredSkillEvaluationRunInputSchema.safeParse({
        revisionId: "revision-7",
        prompt: "Summarise this meeting.",
      }).success,
    ).toBe(true);
    expect(
      authoredSkillEvaluationRunInputSchema.safeParse({ revisionId: "revision-7" }).success,
    ).toBe(false);
    expect(
      authoredSkillEvaluationRunInputSchema.safeParse({
        revisionId: "revision-7",
        caseId: "case-1",
        prompt: "Do both",
      }).success,
    ).toBe(false);
  });
});
