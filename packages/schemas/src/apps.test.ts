import { describe, expect, it } from "vitest";

import { projectExperienceDefinitionSchema, recipeInstallationUpdateRequestSchema } from "./apps";

describe("recipe installation update schema", () => {
  it("does not turn an omitted configuration into an empty update", () => {
    expect(recipeInstallationUpdateRequestSchema.parse({ status: "paused" })).toEqual({
      status: "paused",
    });
  });
});

describe("experience scope schema", () => {
  const experience = {
    id: "lean-proofs",
    runtime: "lean-proofs",
    name: "Lean Proofs",
    description: "Develop and verify Lean proofs in a project repository.",
    scopes: ["project"],
    requirement: {
      kind: "capability",
      capabilityKind: "app",
      capabilityId: "featured-lean-proofs",
    },
  };

  it("supports project-only experiences without accepting duplicate scopes", () => {
    expect(projectExperienceDefinitionSchema.safeParse(experience).success).toBe(true);
    expect(
      projectExperienceDefinitionSchema.safeParse({
        ...experience,
        scopes: ["project", "project"],
      }).success,
    ).toBe(false);
  });
});
