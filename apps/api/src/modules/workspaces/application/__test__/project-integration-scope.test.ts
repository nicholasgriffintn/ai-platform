import { describe, expect, it } from "vitest";

import {
  resolveAllowedProjectConnectorOperations,
  resolveProjectRecipeConnectorScope,
} from "../projectRecipeConnectorScope";

describe("direct project integration grants", () => {
  it("grants exact operations without a recipe and narrows them to recipe authority when present", () => {
    const scope = resolveProjectRecipeConnectorScope([
      {
        kind: "connector",
        capability_id: "devin",
        configuration: { operations: ["list_sessions", "create_session"] },
      },
    ]);

    expect(scope.providers).toEqual(["devin"]);
    expect(
      resolveAllowedProjectConnectorOperations({
        projectScope: scope,
        provider: "devin",
        recipeOperations: undefined,
      }),
    ).toEqual(["list_sessions", "create_session"]);
    expect(
      resolveAllowedProjectConnectorOperations({
        projectScope: scope,
        provider: "devin",
        recipeOperations: ["list_sessions"],
      }),
    ).toEqual(["list_sessions"]);
    expect(
      resolveAllowedProjectConnectorOperations({
        projectScope: scope,
        provider: "netlify",
        recipeOperations: undefined,
      }),
    ).toEqual([]);
  });

  it("denies excluded, malformed and missing grants", () => {
    const scope = resolveProjectRecipeConnectorScope([
      {
        kind: "connector",
        capability_id: "devin",
        excluded: 1,
        configuration: { operations: ["create_session"] },
      },
      { kind: "connector", capability_id: "netlify", configuration: '{"operations": "*"}' },
      { kind: "connector", capability_id: "untrusted", configuration: { operations: ["write"] } },
    ]);

    expect(scope.providers).toEqual([]);
    expect(scope.operationsByProvider).toEqual({});
  });
});
