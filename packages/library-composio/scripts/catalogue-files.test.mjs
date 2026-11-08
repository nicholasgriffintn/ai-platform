import { describe, expect, it } from "vitest";

import { listStaleToolkitFiles, toolkitFileName } from "./catalogue-files.mjs";

describe("Composio catalogue file layout", () => {
  it("lists removed toolkits and rejects unsafe ids", () => {
    expect(listStaleToolkitFiles(["alpha.json", "beta.json", "notes.md"], { beta: {} })).toEqual([
      "alpha.json",
    ]);
    expect(() => toolkitFileName("../secrets")).toThrow(/Unsafe/);
  });
});
