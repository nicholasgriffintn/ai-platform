import { describe, expect, it } from "vitest";

import { discoverPosterWidth } from "./DiscoverSection";

describe("discoverPosterWidth", () => {
  it("sizes every poster in a shared row the same", () => {
    expect(discoverPosterWidth(1140, [4, 2])).toBeCloseTo((1140 - 32 - 12 * 4) / 6);
  });

  it("keeps the wrapped row at the widest section's size instead of stretching", () => {
    expect(discoverPosterWidth(572, [3, 2])).toBeCloseTo((572 - 12 * 2) / 3);
  });

  it("shows only whole posters when the widest section cannot fit", () => {
    expect(discoverPosterWidth(508, [3, 2])).toBeCloseTo((508 - 12) / 2);
  });

  it("never grows past the poster cap", () => {
    expect(discoverPosterWidth(2400, [2, 1])).toBe(320);
  });
});
