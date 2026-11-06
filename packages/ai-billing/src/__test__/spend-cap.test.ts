import { describe, expect, it } from "vitest";

import { isSpendCapReached, resolveSpendState, runStepFitsCap } from "../spend-cap.js";

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

describe("runStepFitsCap", () => {
  it("refuses a step whose estimate would cross the cap, even below the cap today", () => {
    const charge = { chargedCreditMicros: 8_000_000, capCreditMicros: 10_000_000 };

    expect(runStepFitsCap({ ...charge, stepEstimateCreditMicros: 2_000_000 })).toBe(true);
    expect(runStepFitsCap({ ...charge, stepEstimateCreditMicros: 2_000_001 })).toBe(false);
  });

  it("never limits an uncapped run", () => {
    expect(
      runStepFitsCap({
        chargedCreditMicros: 1_000_000_000,
        capCreditMicros: null,
        stepEstimateCreditMicros: 1_000_000_000,
      }),
    ).toBe(true);
  });
});
