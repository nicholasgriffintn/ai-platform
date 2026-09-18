import { describe, expect, it } from "vitest";

import { resolveProjectTeammateIds, resolveRemovedProjectTeammates } from "../access";

const grant = (capabilityId: string, excluded = false) => ({
  kind: "teammate",
  capability_id: capabilityId,
  excluded,
});

describe("project teammate defaults", () => {
  it("gives a project every default teammate without it asking", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [],
        defaultTeammateIds: ["teammate-1", "teammate-2", "platform-research"],
      }),
    ).toEqual(["teammate-1", "teammate-2", "platform-research"]);
  });

  it("keeps a default out of a project that removed it", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [grant("teammate-1", true), grant("platform-research", true)],
        defaultTeammateIds: ["teammate-1", "teammate-2", "platform-research"],
      }),
    ).toEqual(["teammate-2"]);
  });

  it("does not list a teammate twice when it is both attached and a default", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [grant("teammate-1")],
        defaultTeammateIds: ["teammate-1"],
      }),
    ).toEqual(["teammate-1"]);
  });

  it("still honours a teammate attached to the project directly", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [grant("teammate-3")],
        defaultTeammateIds: [],
      }),
    ).toEqual(["teammate-3"]);
  });

  it("treats an exclusion row from SQLite as a removal, not a grant", () => {
    expect(
      resolveProjectTeammateIds({
        capabilities: [{ kind: "teammate", capability_id: "platform-research", excluded: 1 }],
        defaultTeammateIds: ["platform-research"],
      }),
    ).toEqual([]);
  });

  it("ignores an exclusion for something that is not a teammate", () => {
    expect(
      resolveRemovedProjectTeammates([
        { kind: "app", capability_id: "featured-notes", excluded: true },
      ]),
    ).toEqual(new Set());
  });
});
