import { describe, expect, it } from "vitest";

import { getPrivateFileResourceFromUrl } from "./resource-urls";

describe("getPrivateFileResourceFromUrl", () => {
  it("recognises relative and same-origin private file URLs", () => {
    expect(
      getPrivateFileResourceFromUrl("/sources/source-1/content", "http://localhost:8787"),
    ).toEqual({ kind: "source", id: "source-1" });
    expect(
      getPrivateFileResourceFromUrl(
        "http://localhost:8787/outputs/output-1/content",
        "http://localhost:8787",
      ),
    ).toEqual({ kind: "output", id: "output-1" });
  });

  it("does not treat another origin as an internal private file URL", () => {
    expect(
      getPrivateFileResourceFromUrl(
        "https://files.example/sources/source-1/content",
        "http://localhost:8787",
      ),
    ).toBeUndefined();
  });
});
