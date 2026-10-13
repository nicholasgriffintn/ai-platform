import { describe, expect, it } from "vitest";

import { fitBradleyTerry, type PairwiseVote } from "../ratings.js";
import { rankBySignificance } from "../standings.js";

describe("Bradley–Terry ratings", () => {
  it("orders entrants by who beats whom and keeps unbeaten entrants finite", () => {
    const votes: PairwiseVote[] = [
      ...Array.from({ length: 6 }, (): PairwiseVote => ({ left: "a", right: "b", winner: "left" })),
      ...Array.from({ length: 6 }, (): PairwiseVote => ({ left: "b", right: "c", winner: "left" })),
      { left: "a", right: "c", winner: "tie" },
    ];
    const ratings = fitBradleyTerry(votes);
    const a = ratings.get("a");
    const b = ratings.get("b");
    const c = ratings.get("c");

    expect(a && b && c).toBeTruthy();
    expect(a?.rating).toBeGreaterThan(b?.rating ?? Infinity);
    expect(b?.rating).toBeGreaterThan(c?.rating ?? Infinity);
    expect(Number.isFinite(a?.rating)).toBe(true);
    expect(a).toMatchObject({ wins: 6, losses: 0, ties: 1 });
  });
});

describe("rankBySignificance", () => {
  it("shares a rank when intervals overlap and separates clear gaps", () => {
    const ranked = rankBySignificance(
      [
        { id: "first", value: 0.8, low: 0.7, high: 0.9 },
        { id: "close", value: 0.75, low: 0.65, high: 0.85 },
        { id: "far", value: 0.3, low: 0.2, high: 0.4 },
        { id: "unscored", value: null },
      ],
      (entry) => (entry.value === null ? null : entry),
    );

    expect(ranked.map(({ entry, rank, tied }) => [entry.id, rank, tied])).toEqual([
      ["first", 1, true],
      ["close", 1, true],
      ["far", 3, false],
      ["unscored", 4, false],
    ]);
  });
});
