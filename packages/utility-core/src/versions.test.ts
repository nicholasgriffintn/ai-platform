import { describe, expect, it } from "vitest";

import { compareSemanticVersions, isNewerVersion } from "./versions.js";

describe("compareSemanticVersions", () => {
  it("orders releases by each numeric part rather than lexically", () => {
    expect(compareSemanticVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareSemanticVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("treats missing parts as zero", () => {
    expect(compareSemanticVersions("1.2", "1.2.0")).toBe(0);
    expect(compareSemanticVersions("1.2.1", "1.2")).toBeGreaterThan(0);
  });

  it("ranks a prerelease below its own release", () => {
    expect(compareSemanticVersions("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
    expect(compareSemanticVersions("1.0.0-beta.2", "1.0.0-beta.1")).toBeGreaterThan(0);
  });

  it("ignores build metadata and a leading v", () => {
    expect(compareSemanticVersions("v1.0.0+build.5", "1.0.0")).toBe(0);
  });

  it("refuses to order versions it cannot parse", () => {
    expect(compareSemanticVersions("nightly", "1.0.0")).toBe(0);
  });
});

describe("isNewerVersion", () => {
  it("only accepts a strictly newer candidate", () => {
    expect(isNewerVersion("1.1.0", "1.0.0")).toBe(true);
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("0.9.0", "1.0.0")).toBe(false);
  });
});
