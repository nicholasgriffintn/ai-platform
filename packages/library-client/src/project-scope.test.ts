import { describe, expect, it } from "vitest";

import { withProjectScope } from "./project-scope.js";

describe("withProjectScope", () => {
  it("adds an encoded project ID to a path without a query string", () => {
    expect(withProjectScope("/experiences/notes", "project / 1")).toBe(
      "/experiences/notes?project_id=project%20%2F%201",
    );
  });

  it("adds an encoded project ID without replacing existing parameters", () => {
    expect(withProjectScope("/outputs?limit=10", "project / 1")).toBe(
      "/outputs?limit=10&project_id=project%20%2F%201",
    );
  });
});
