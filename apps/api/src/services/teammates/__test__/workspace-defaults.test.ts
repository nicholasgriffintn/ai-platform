import { describe, expect, it } from "vitest";

import { resolveProjectTeammateIds, resolveRemovedProjectTeammates } from "../access";

const grant = (capabilityId: string, excluded = false) => ({
  kind: "teammate",
  capability_id: capabilityId,
  excluded,
});

describe("workspace teammate defaults", () => {
  it("gives a project every workspace default without it asking", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [],
        workspaceDefaultTeammateIds: ["teammate-1", "teammate-2"],
      }),
    ).toEqual(["teammate-1", "teammate-2"]);
  });

  it("keeps a default out of a project that removed it", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [grant("teammate-1", true)],
        workspaceDefaultTeammateIds: ["teammate-1", "teammate-2"],
      }),
    ).toEqual(["teammate-2"]);
  });

  it("does not list a teammate twice when it is both attached and a default", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [grant("teammate-1")],
        workspaceDefaultTeammateIds: ["teammate-1"],
      }),
    ).toEqual(["teammate-1"]);
  });

  it("ignores an exclusion for something that is not a teammate", () => {
    expect(
      resolveRemovedProjectTeammates([
        { kind: "app", capability_id: "featured-notes", excluded: true },
      ]),
    ).toEqual(new Set());
  });

  it("still honours a teammate attached to the project directly", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [grant("teammate-3")],
        workspaceDefaultTeammateIds: [],
      }),
    ).toEqual(["teammate-3"]);
  });
});
