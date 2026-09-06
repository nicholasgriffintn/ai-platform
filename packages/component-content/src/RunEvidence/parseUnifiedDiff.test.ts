import { describe, expect, it } from "vitest";

import { orderDiffFilesForReview, parseUnifiedDiff, type DiffFile } from "./parseUnifiedDiff";

function file(path: string): DiffFile {
  return {
    path,
    oldPath: path,
    status: "modified",
    hunks: [],
    additions: 0,
    deletions: 0,
    binary: false,
  };
}

describe("parseUnifiedDiff", () => {
  it("reads both paths out of a header", () => {
    const [parsed] = parseUnifiedDiff(
      "diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n",
    );

    expect(parsed?.oldPath).toBe("src/app.ts");
    expect(parsed?.path).toBe("src/app.ts");
  });

  it("splits on the first separator, as the old pattern did", () => {
    const [parsed] = parseUnifiedDiff("diff --git a/my b/dir b/my b/dir\n");

    expect(parsed?.oldPath).toBe("my");
    expect(parsed?.path).toBe("dir b/my b/dir");
  });

  it("ignores a header with nothing after the separator", () => {
    expect(parseUnifiedDiff("diff --git a/only\n")).toEqual([]);
  });

  it("stays linear on a header of many separators", () => {
    const started = Date.now();

    parseUnifiedDiff(`diff --git a/${" b/".repeat(40_000)}\n`);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe("orderDiffFilesForReview", () => {
  it("puts schema, configuration and migration files first", () => {
    const ordered = orderDiffFilesForReview([
      file("src/app.ts"),
      file("vite.config.ts"),
      file("package.json"),
      file("src/schema.ts"),
    ]).map((entry) => entry.path);

    expect(ordered.slice(0, 3).sort()).toEqual(["package.json", "src/schema.ts", "vite.config.ts"]);
    expect(ordered[3]).toBe("src/app.ts");
  });

  it("puts tests last, whether named by folder or by suffix", () => {
    const ordered = orderDiffFilesForReview([
      file("src/app.test.ts"),
      file("src/app.ts"),
      file("__tests__/app.ts"),
      file("spec/app.ts"),
    ]).map((entry) => entry.path);

    expect(ordered[0]).toBe("src/app.ts");
    expect(ordered.slice(1).sort()).toEqual(["__tests__/app.ts", "spec/app.ts", "src/app.test.ts"]);
  });

  it("does not mistake a file merely containing test for a test file", () => {
    const ordered = orderDiffFilesForReview([file("src/latest.ts"), file("src/app.test.ts")]).map(
      (entry) => entry.path,
    );

    expect(ordered[0]).toBe("src/latest.ts");
  });

  it("stays linear on a deeply nested path", () => {
    const started = Date.now();

    orderDiffFilesForReview([file(`${"config".repeat(20_000)}.ts`)]);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
