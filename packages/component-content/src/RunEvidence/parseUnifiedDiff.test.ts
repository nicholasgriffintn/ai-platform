// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./parseUnifiedDiff";

describe("parseUnifiedDiff", () => {
  it("reads both paths out of a header", () => {
    const [parsed] = parseUnifiedDiff(
      "diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n",
    );

    expect(parsed?.oldPath).toBe("src/app.ts");
    expect(parsed?.path).toBe("src/app.ts");
  });

  it("stays linear on a header of many separators", () => {
    const started = Date.now();

    parseUnifiedDiff(`diff --git a/${" b/".repeat(40_000)}\n`);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
