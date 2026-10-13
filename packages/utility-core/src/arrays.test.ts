import { describe, expect, it } from "vitest";

import { randomIndex, shuffleCopy, sortCopy } from "./arrays.js";

describe("randomIndex", () => {
  it("stays inside the range and refuses empty ranges", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const index = randomIndex(3);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }

    expect(() => randomIndex(0)).toThrow(RangeError);
  });
});

describe("shuffleCopy", () => {
  it("keeps every value and leaves the input untouched", () => {
    const values = [1, 2, 3, 4, 5];

    expect(sortCopy(shuffleCopy(values), (left, right) => left - right)).toEqual(values);
    expect(values).toEqual([1, 2, 3, 4, 5]);
  });
});
