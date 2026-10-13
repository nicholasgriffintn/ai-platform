import { projectExperienceDefinitionSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getExperienceCatalog, getProjectExperienceCatalog } from "../config";

describe("the App catalogue", () => {
  it("publishes every App in the shape consumers parse", () => {
    for (const experience of getProjectExperienceCatalog()) {
      expect(projectExperienceDefinitionSchema.safeParse(experience)).toMatchObject({
        success: true,
      });
    }
  });

  it("gives every App a unique id and, where it has one, a unique capability", () => {
    const experiences = getExperienceCatalog();
    const ids = experiences.map((experience) => experience.id);
    const capabilityIds = experiences
      .map((experience) => experience.capabilityId)
      .filter((capabilityId): capabilityId is string => Boolean(capabilityId));

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(capabilityIds).size).toBe(capabilityIds.length);
  });
});
