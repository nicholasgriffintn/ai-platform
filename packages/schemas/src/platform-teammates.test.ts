import { describe, expect, it } from "vitest";

import {
  findPlatformTeammate,
  isPlatformTeammateId,
  listPlatformTeammateIds,
  PLATFORM_TEAMMATES,
  platformTeammateId,
} from "./platform-teammates.js";
import { skillIdSchema } from "./skills.js";
import { toolIdSchema } from "./tool-ids.js";

describe("platform teammates", () => {
  it("gives every teammate a stable id derived from its slug", () => {
    expect(PLATFORM_TEAMMATES.length).toBeGreaterThan(0);
    expect(new Set(listPlatformTeammateIds()).size).toBe(PLATFORM_TEAMMATES.length);

    for (const teammate of PLATFORM_TEAMMATES) {
      expect(teammate.id).toBe(platformTeammateId(teammate.slug));
      expect(isPlatformTeammateId(teammate.id)).toBe(true);
      expect(findPlatformTeammate(teammate.id)).toBe(teammate);
      expect(findPlatformTeammate(teammate.slug)).toBe(teammate);
    }
  });

  it("only references tools that exist in the shared tool id format", () => {
    for (const teammate of PLATFORM_TEAMMATES) {
      for (const toolId of teammate.tools) {
        expect(toolIdSchema.safeParse(toolId).success, `${teammate.slug}: ${toolId}`).toBe(true);
      }

      for (const skillId of teammate.skillIds) {
        expect(skillIdSchema.safeParse(skillId).success, `${teammate.slug}: ${skillId}`).toBe(true);
      }
    }
  });

  it("does not claim an id outside the platform prefix", () => {
    expect(isPlatformTeammateId("teammate-123")).toBe(false);
    expect(findPlatformTeammate("teammate-123")).toBeUndefined();
  });
});
