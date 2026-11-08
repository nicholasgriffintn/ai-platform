import { describe, expect, it } from "vitest";

import { readSiteReferenceFontFamily } from "../reference";

describe("readSiteReferenceFontFamily", () => {
  it("skips generic and unsafe family names", () => {
    expect(readSiteReferenceFontFamily("-apple-system, system-ui, sans-serif")).toBeNull();
    expect(readSiteReferenceFontFamily('"Evil\\"; } body { x", serif')).toBeNull();
  });
});
