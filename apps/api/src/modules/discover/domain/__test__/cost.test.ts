import { describe, expect, it } from "vitest";

import { episodeUsagePlan, pickAffordableLength, remainingCreditMicros } from "../cost";

const costs = { short: 100, standard: 250, long: 400 };

describe("episode budget", () => {
  it("costs more for longer episodes", () => {
    const [short, standard, long] = (["short", "standard", "long"] as const).map(episodeUsagePlan);

    expect(short.characters).toBeLessThan(standard.characters);
    expect(standard.images).toBeLessThan(long.images);
    expect(short.inputTokens).toBeLessThan(long.inputTokens);
  });

  it("drops to the longest length the budget still covers", () => {
    expect(pickAffordableLength("long", costs, 300)).toBe("standard");
    expect(pickAffordableLength("long", costs, 120)).toBe("short");
    expect(pickAffordableLength("standard", costs, 1_000)).toBe("standard");
  });

  it("makes nothing once the budget is spent, and anything when there is no cap", () => {
    expect(pickAffordableLength("short", costs, 50)).toBeNull();
    expect(pickAffordableLength("long", costs, null)).toBe("long");
    expect(remainingCreditMicros({ creditMicros: 900, capCreditMicros: 600 })).toBe(0);
    expect(remainingCreditMicros({ creditMicros: 900, capCreditMicros: null })).toBeNull();
  });
});
