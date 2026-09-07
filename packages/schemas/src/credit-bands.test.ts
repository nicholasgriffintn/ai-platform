import { describe, expect, it } from "vitest";

import {
  CREDIT_BANDS,
  describeCreditBand,
  formatCreditBandRange,
  summariseCreditSpend,
  sumRunCreditMicros,
} from "./credit-bands.js";
import { creditMicrosFromCredits } from "./pricing/constants.js";

describe("describeCreditBand", () => {
  it("names a small ask an everyday one", () => {
    expect(describeCreditBand(0.4).id).toBe("everyday");
  });

  it("puts a boundary value in the band it opens, not the one it closes", () => {
    expect(describeCreditBand(1).id).toBe("deep-work");
    expect(describeCreditBand(25).id).toBe("big-build");
  });

  it("keeps naming the largest band however far past it a run goes", () => {
    expect(describeCreditBand(50_000).id).toBe("big-build");
  });

  it("treats a nonsense figure as nothing spent rather than the largest band", () => {
    expect(describeCreditBand(Number.NaN).id).toBe("everyday");
    expect(describeCreditBand(-10).id).toBe("everyday");
  });
});

describe("formatCreditBandRange", () => {
  it("leaves the open-ended band open", () => {
    const bigBuild = CREDIT_BANDS.find((band) => band.id === "big-build");

    expect(bigBuild && formatCreditBandRange(bigBuild)).toBe("25 credits and up");
  });
});

describe("summariseCreditSpend", () => {
  it("adds up what several runs spent and names the band it reaches", () => {
    const micros = sumRunCreditMicros([
      { consumption: { creditMicros: creditMicrosFromCredits(3) } },
      { consumption: { creditMicros: creditMicrosFromCredits(4.5) } },
      undefined,
    ] as never);

    expect(summariseCreditSpend(micros)).toEqual({
      credits: 7.5,
      band: CREDIT_BANDS.find((band) => band.id === "deep-work"),
    });
  });

  it("reports nothing spent when no run has reported usage", () => {
    expect(summariseCreditSpend(sumRunCreditMicros([undefined, undefined]))).toMatchObject({
      credits: 0,
    });
  });
});
