import { describe, expect, it } from "vitest";

import { canCombineArtifacts } from "./artifact-kinds";

describe("canCombineArtifacts", () => {
  it("combines an HTML document with its stylesheet", () => {
    expect(
      canCombineArtifacts([
        { type: "text/html", language: "html" },
        { type: "text/css", language: "css" },
      ]),
    ).toBe(true);
  });

  it("does not combine a stylesheet without a runnable artifact", () => {
    expect(
      canCombineArtifacts([
        { type: "text/markdown", language: "markdown" },
        { type: "text/css", language: "css" },
      ]),
    ).toBe(false);
  });
});
