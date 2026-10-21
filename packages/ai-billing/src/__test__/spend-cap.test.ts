import { describe, expect, it } from "vitest";

import { isSpendCapReached, resolveSpendState } from "../spend-cap.js";

describe("resolveSpendState", () => {
  it("is uncapped without a positive cap", () => {
    expect(resolveSpendState(5_000_000, null)).toBe("uncapped");
    expect(resolveSpendState(5_000_000, 0)).toBe("uncapped");
  });

  it("moves from ok to near at four fifths and to reached at the cap", () => {
    expect(resolveSpendState(1_000_000, 10_000_000)).toBe("ok");
    expect(resolveSpendState(8_000_000, 10_000_000)).toBe("near");
    expect(resolveSpendState(10_000_000, 10_000_000)).toBe("reached");
    expect(isSpendCapReached(12_000_000, 10_000_000)).toBe(true);
    expect(isSpendCapReached(2_000_000, 10_000_000)).toBe(false);
  });
});
