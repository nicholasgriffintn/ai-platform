import { describe, expect, it } from "vitest";

import { hexToOklch, oklchToHex } from "./colors";

describe("hexToOklch", () => {
  it("round-trips through oklchToHex", () => {
    for (const hex of ["#635bff", "#0a2540", "#f6f9fc", "#e4572e", "#1f7a4d"]) {
      const colour = hexToOklch(hex);

      expect(colour && oklchToHex(colour)).toBe(hex);
    }
  });

  it("reports achromatic colours with zero hue", () => {
    expect(hexToOklch("#ffffff")).toEqual({
      lightness: expect.closeTo(1, 3),
      chroma: expect.closeTo(0, 3),
      hue: 0,
    });
  });

  it("rejects values that are not six-digit hex", () => {
    expect(hexToOklch("#fff")).toBeNull();
    expect(hexToOklch("rgb(0, 0, 0)")).toBeNull();
  });
});
