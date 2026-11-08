import { describe, expect, it } from "vitest";

import { isDiscoverImageType } from "../live";

describe("isDiscoverImageType", () => {
  it("accepts photos and refuses anything that can carry script", () => {
    expect(isDiscoverImageType("image/jpeg")).toBe(true);
    expect(isDiscoverImageType("image/webp; charset=binary")).toBe(true);
    expect(isDiscoverImageType("image/svg+xml")).toBe(false);
    expect(isDiscoverImageType("text/html")).toBe(false);
  });
});
