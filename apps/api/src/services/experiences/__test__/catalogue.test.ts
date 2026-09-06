import {
  APP_IOS_DECISIONS,
  projectExperienceDefinitionSchema,
} from "@ngriffin_uk/polychat-schemas";
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

  it("makes every App say when to reach for it, what it uses and what it leaves behind", () => {
    for (const experience of getExperienceCatalog()) {
      expect(experience.when.trim().length, `${experience.id} has no "when"`).toBeGreaterThan(0);
      expect(experience.uses.trim().length, `${experience.id} has no "uses"`).toBeGreaterThan(0);
      expect(
        experience.produces.trim().length,
        `${experience.id} has no "produces"`,
      ).toBeGreaterThan(0);
    }
  });

  it("records an iOS decision for every App rather than leaving it open", () => {
    for (const experience of getExperienceCatalog()) {
      expect(APP_IOS_DECISIONS, `${experience.id} has no iOS decision`).toContain(experience.ios);
    }
  });

  it("makes a personal-only App give its reason, and never the other way round", () => {
    for (const experience of getExperienceCatalog()) {
      if (experience.scope === "personal") {
        expect(experience.scopeReason?.trim().length ?? 0).toBeGreaterThan(0);
      } else {
        expect(experience.scopeReason).toBeUndefined();
      }
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
