import { describe, expect, it } from "vitest";

import { fuseRankedMatches } from "./ranking.js";

describe("ranked retrieval", () => {
  it("combines independent rankings without rewarding duplicate candidates within a branch", () => {
    const rankings = [
      ["identifier", "semantic", "identifier"],
      ["semantic", "other"],
    ];
    const result = fuseRankedMatches(rankings, (id) => id);

    expect(result.map(({ match }) => match)).toEqual(["semantic", "identifier", "other"]);
  });
});
