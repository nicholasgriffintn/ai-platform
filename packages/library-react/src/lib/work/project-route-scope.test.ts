import { describe, expect, it } from "vitest";

import { requireProjectRouteScope } from "./project-route-scope";

describe("project route scope", () => {
  const project = { id: "project-1", workspaceId: "workspace-1" };

  it("keeps a project inside its canonical workspace route", () => {
    expect(requireProjectRouteScope(project, "workspace-1")).toBe(project);
  });

  it("rejects a project rendered under another workspace route", () => {
    expect(() => requireProjectRouteScope(project, "workspace-2")).toThrow(
      "Project not found in this workspace",
    );
  });
});
